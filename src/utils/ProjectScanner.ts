import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ProjectInfo, WorkspaceStructure, DeployEnvironment, PublishProfileInfo } from '../models/ProjectModels';
import { PublishProfileParser } from './PublishProfileParser';

/**
 * Scanner for .NET projects and publish profiles in the workspace
 */
export class ProjectScanner {
    private parser: PublishProfileParser;
    private cache: WorkspaceStructure | null = null;
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL = 5000; // 5 seconds

    constructor() {
        this.parser = new PublishProfileParser();
    }

    /**
     * Scan workspace for .NET projects and their publish profiles
     */
    async scanWorkspace(workspaceRoot: string): Promise<WorkspaceStructure> {
        // Return cached result if still valid
        const now = Date.now();
        if (this.cache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
            return this.cache;
        }

        const projects = await this.findProjects(workspaceRoot);

        // Enrich each project with publish profiles
        for (const project of projects) {
            project.profiles = await this.findPublishProfiles(project.projectDir);
        }

        const structure: WorkspaceStructure = {
            projects: projects,
            hasServerClientStructure: this.detectServerClientStructure(projects),
        };

        // Update cache
        this.cache = structure;
        this.cacheTimestamp = now;

        return structure;
    }

    /**
     * Clear the cache to force a fresh scan
     */
    clearCache(): void {
        this.cache = null;
        this.cacheTimestamp = 0;
    }

    /**
     * Recursively find all .csproj files in the workspace
     */
    private async findProjects(rootPath: string): Promise<ProjectInfo[]> {
        const projects: ProjectInfo[] = [];

        // Use VS Code's findFiles API for better performance
        const csprojFiles = await vscode.workspace.findFiles(
            '**/*.csproj',
            '**/node_modules/**,**/bin/**,**/obj/**'
        );

        for (const uri of csprojFiles) {
            const csprojPath = uri.fsPath;
            const projectDir = path.dirname(csprojPath);
            const projectName = path.basename(csprojPath, '.csproj');
            const projectType = this.detectProjectType(projectName, csprojPath);
            const targetFramework = await this.extractTargetFramework(csprojPath);

            projects.push({
                name: projectName,
                csprojPath: csprojPath,
                projectDir: projectDir,
                projectType: projectType,
                profiles: [], // Will be populated later
                targetFramework: targetFramework,
            });
        }

        return projects;
    }

    /**
     * Extract TargetFramework from .csproj file
     */
    private async extractTargetFramework(csprojPath: string): Promise<string | undefined> {
        try {
            const content = fs.readFileSync(csprojPath, 'utf-8');
            const { XMLParser } = require('fast-xml-parser');
            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: '@_'
            });

            const parsed = parser.parse(content);
            const project = parsed?.Project;

            if (!project) return undefined;

            // Look for PropertyGroup with TargetFramework or TargetFrameworks
            const propertyGroups = Array.isArray(project.PropertyGroup)
                ? project.PropertyGroup
                : [project.PropertyGroup];

            for (const group of propertyGroups) {
                if (!group) continue;

                // Single target framework
                if (group.TargetFramework) {
                    return group.TargetFramework;
                }

                // Multiple target frameworks - take the first one
                if (group.TargetFrameworks) {
                    const frameworks = group.TargetFrameworks.split(';');
                    return frameworks[0]?.trim();
                }
            }

            return undefined;
        } catch (error) {
            console.error(`Failed to extract TargetFramework from ${csprojPath}:`, error);
            return undefined;
        }
    }

    /**
     * Find all publish profiles for a given project
     */
    private async findPublishProfiles(projectDir: string): Promise<PublishProfileInfo[]> {
        const profiles: PublishProfileInfo[] = [];
        const publishProfilesDir = path.join(projectDir, 'Properties', 'PublishProfiles');

        if (!fs.existsSync(publishProfilesDir)) {
            return profiles;
        }

        try {
            const files = fs.readdirSync(publishProfilesDir);

            for (const file of files) {
                if (file.endsWith('.pubxml')) {
                    const pubxmlPath = path.join(publishProfilesDir, file);
                    const profileInfo = this.parser.parseProfile(pubxmlPath);

                    if (profileInfo) {
                        profiles.push(profileInfo);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to read publish profiles from ${publishProfilesDir}:`, error);
        }

        // Sort profiles: DEV -> UAT -> PROD
        return profiles.sort((a, b) => {
            const order: Record<string, number> = {
                [DeployEnvironment.Development]: 1,
                [DeployEnvironment.Staging]: 2,
                [DeployEnvironment.Production]: 3,
                [DeployEnvironment.Unknown]: 4
            };
            return (order[a.environment] || 99) - (order[b.environment] || 99);
        });
    }

    /**
     * Detect project type from name or content
     */
    private detectProjectType(projectName: string, csprojPath: string): 'api' | 'web' | 'library' | 'unknown' {
        const lowerName = projectName.toLowerCase();

        if (lowerName.includes('api')) {
            return 'api';
        }
        if (lowerName.includes('web') || lowerName.includes('blazor')) {
            return 'web';
        }
        if (lowerName.includes('shared') || lowerName.includes('lib') || lowerName.includes('core')) {
            return 'library';
        }

        // TODO: Could also read .csproj content to detect SDK type
        // <Project Sdk="Microsoft.NET.Sdk.Web"> vs <Project Sdk="Microsoft.NET.Sdk">

        return 'unknown';
    }

    /**
     * Detect if workspace has a typical Server/Client folder structure
     */
    private detectServerClientStructure(projects: ProjectInfo[]): boolean {
        const hasServer = projects.some(p => p.projectDir.includes('Server') || p.projectDir.includes('server'));
        const hasClient = projects.some(p => p.projectDir.includes('Client') || p.projectDir.includes('client'));

        return hasServer && hasClient;
    }
}
