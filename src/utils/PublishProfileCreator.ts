import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ProjectInfo } from '../models/ProjectModels';
import { EnvironmentManager } from './EnvironmentManager';

interface ProfileWizardData {
    profileName: string;
    environment: 'uat' | 'prod' | 'dev';
    publishUrl: string;
    siteName: string;
    username: string;
    password: string;
    siteUrl?: string;
}

/**
 * Creates new publish profiles with interactive wizard
 */
export class PublishProfileCreator {
    private envManager: EnvironmentManager;
    private xmlParser: XMLParser;

    constructor() {
        this.envManager = new EnvironmentManager();
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });
    }

    /**
     * Launch wizard to create a new publish profile
     */
    async createProfileWizard(projectInfo: ProjectInfo, outputChannel: vscode.OutputChannel): Promise<boolean> {
        try {
            // Collect profile data through multi-step wizard
            const data = await this.collectProfileData();
            
            if (!data) {
                return false; // User cancelled
            }

            // Detect .NET version from .csproj
            const targetFramework = await this.detectTargetFramework(projectInfo.csprojPath);

            // Generate .pubxml content
            const pubxmlContent = this.generatePubxmlContent(data, targetFramework);

            // Save .pubxml file
            const pubxmlPath = await this.savePubxmlFile(projectInfo, data.profileName, pubxmlContent);

            if (!pubxmlPath) {
                return false;
            }

            // Save password to environment variable (include project name)
            const passwordVarName = this.envManager.generatePasswordVarName(projectInfo.name, data.profileName);
            await this.envManager.setEnvironmentVariable(passwordVarName, data.password, outputChannel);

            // Show success message
            vscode.window.showInformationMessage(
                `✅ Profile "${data.profileName}" created successfully!`,
                'OK'
            );

            outputChannel.appendLine(`[Profile] Created: ${pubxmlPath}`);
            outputChannel.appendLine(`[Profile] Password variable: ${passwordVarName}`);
            outputChannel.show();

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create profile: ${error}`);
            return false;
        }
    }

    /**
     * Multi-step input to collect profile information
     */
    private async collectProfileData(): Promise<ProfileWizardData | undefined> {
        // Step 1: Profile name
        const profileName = await vscode.window.showInputBox({
            prompt: 'Enter profile name (e.g., uat-api, prod-web)',
            placeHolder: 'uat-api',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Profile name is required';
                }
                if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
                    return 'Profile name can only contain letters, numbers, hyphens, and underscores';
                }
                return null;
            }
        });

        if (!profileName) {return undefined;}

        // Step 2: Environment
        const environment = await vscode.window.showQuickPick(
            [
                { label: 'UAT', value: 'uat' as const, description: 'User Acceptance Testing environment' },
                { label: 'PROD', value: 'prod' as const, description: 'Production environment ⚠️' },
                { label: 'DEV', value: 'dev' as const, description: 'Development environment' },
            ],
            { placeHolder: 'Select environment type' }
        );

        if (!environment) {return undefined;}

        // Step 3: Publish URL (IP or domain)
        const publishUrl = await vscode.window.showInputBox({
            prompt: 'Enter publish URL (IP address or domain)',
            placeHolder: '192.168.10.3',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Publish URL is required';
                }
                return null;
            }
        });

        if (!publishUrl) {return undefined;}

        // Step 4: IIS Site name
        const siteName = await vscode.window.showInputBox({
            prompt: 'Enter IIS site name (DeployIisAppPath)',
            placeHolder: 'TS_BUDGETCTRL_API_UAT',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Site name is required';
                }
                return null;
            }
        });

        if (!siteName) {return undefined;}

        // Step 5: Site URL (optional, for browser launch)
        const siteUrl = await vscode.window.showInputBox({
            prompt: 'Enter site URL for browser launch (optional)',
            placeHolder: 'https://budgetdevapi.trungsonpharma.com',
        });

        // Step 6: Username
        const username = await vscode.window.showInputBox({
            prompt: 'Enter deployment username',
            placeHolder: 'namnh',
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Username is required';
                }
                return null;
            }
        });

        if (!username) {return undefined;}

        // Step 7: Password
        const password = await vscode.window.showInputBox({
            prompt: 'Enter deployment password',
            password: true,
            validateInput: (value) => {
                if (!value || value.trim().length === 0) {
                    return 'Password is required';
                }
                return null;
            }
        });

        if (!password) {return undefined;}

        return {
            profileName,
            environment: environment.value,
            publishUrl,
            siteName,
            username,
            password,
            siteUrl: siteUrl || undefined,
        };
    }

    /**
     * Detect TargetFramework from .csproj file
     */
    private async detectTargetFramework(csprojPath: string): Promise<string> {
        try {
            const csprojContent = fs.readFileSync(csprojPath, 'utf-8');
            const parsed = this.xmlParser.parse(csprojContent);

            // Try to find TargetFramework in PropertyGroup
            const propertyGroups = parsed?.Project?.PropertyGroup;
            
            if (Array.isArray(propertyGroups)) {
                for (const group of propertyGroups) {
                    if (group.TargetFramework) {
                        return group.TargetFramework;
                    }
                }
            } else if (propertyGroups?.TargetFramework) {
                return propertyGroups.TargetFramework;
            }

            // Fallback to net8.0
            return 'net8.0';
        } catch (error) {
            console.error('Failed to parse .csproj:', error);
            return 'net8.0'; // Safe default
        }
    }

    /**
     * Generate .pubxml XML content based on user's template
     */
    private generatePubxmlContent(data: ProfileWizardData, targetFramework: string): string {
        const siteUrl = data.siteUrl || `https://${data.publishUrl}`;
        const projectGuid = this.generateGuid();

        return `<?xml version="1.0" encoding="utf-8"?>
<!-- https://go.microsoft.com/fwlink/?LinkID=208121. -->
<Project>
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <LaunchSiteAfterPublish>true</LaunchSiteAfterPublish>
    <LastUsedBuildConfiguration>Release</LastUsedBuildConfiguration>
    <LastUsedPlatform>Any CPU</LastUsedPlatform>
    <SiteUrlToLaunchAfterPublish>${siteUrl}</SiteUrlToLaunchAfterPublish>
    <ExcludeApp_Data>false</ExcludeApp_Data>
    <ProjectGuid>${projectGuid}</ProjectGuid>
    <SelfContained>false</SelfContained>
    <MSDeployServiceURL>${data.publishUrl}</MSDeployServiceURL>
    <DeployIisAppPath>${data.siteName}</DeployIisAppPath>
    <RemoteSitePhysicalPath />
    <SkipExtraFilesOnServer>true</SkipExtraFilesOnServer>
    <MSDeployPublishMethod>WMSVC</MSDeployPublishMethod>
    <EnableMSDeployBackup>true</EnableMSDeployBackup>
    <EnableMsDeployAppOffline>true</EnableMsDeployAppOffline>
    <UserName>${data.username}</UserName>
    <_SavePWD>true</_SavePWD>
    <_TargetId>IISWebDeploy</_TargetId>
    <EnvironmentName>${data.environment === 'prod' ? 'Production' : 'Staging'}</EnvironmentName>
    <TargetFramework>${targetFramework}</TargetFramework>
  </PropertyGroup>
</Project>
`;
    }

    /**
     * Save .pubxml file to Properties/PublishProfiles
     */
    private async savePubxmlFile(projectInfo: ProjectInfo, profileName: string, content: string): Promise<string | null> {
        try {
            const publishProfilesDir = path.join(projectInfo.projectDir, 'Properties', 'PublishProfiles');

            // Create directory if it doesn't exist
            if (!fs.existsSync(publishProfilesDir)) {
                fs.mkdirSync(publishProfilesDir, { recursive: true });
            }

            const pubxmlPath = path.join(publishProfilesDir, `${profileName}.pubxml`);

            // Check if file already exists
            if (fs.existsSync(pubxmlPath)) {
                const overwrite = await vscode.window.showWarningMessage(
                    `Profile "${profileName}" already exists. Overwrite?`,
                    'Overwrite',
                    'Cancel'
                );

                if (overwrite !== 'Overwrite') {
                    return null;
                }
            }

            // Write file
            fs.writeFileSync(pubxmlPath, content, 'utf-8');
            return pubxmlPath;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save .pubxml file: ${error}`);
            return null;
        }
    }

    /**
     * Generate a random GUID for ProjectGuid
     */
    private generateGuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
}
