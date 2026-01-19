/**
 * Model definitions for .NET projects and publish profiles
 */

export enum DeployEnvironment {
    Development = 'dev',
    Staging = 'staging',
    Production = 'production',
    Unknown = 'unknown'
}

export interface PublishProfileInfo {
    /** Display name for the profile (e.g., "uat-api [UAT]") */
    name: string;

    /** Full path to the .pubxml file */
    path: string;

    /** Base filename without extension (e.g., "uat-api") */
    fileName: string;

    /** Detected environment type */
    environment: DeployEnvironment;

    /** Whether this is a production profile */
    isProduction: boolean;

    /** Publish URL from the profile (optional) */
    publishUrl?: string;

    /** Web deploy method (e.g., MSDeploy) */
    publishMethod?: string; // MSDeploy, FileSystem, etc

    /** IIS Site Name (for MSDeploy) */
    siteName?: string;

    /** Destination Site URL (for browser launch) */
    siteUrl?: string;

    /** Username for deployment */
    userName?: string;

    /** Whether to open browser after deployment */
    openBrowserOnDeploy?: boolean;

    /** Whether to enable stdout logging in web.config after deployment */
    enableStdoutLog?: boolean;
}

export interface ProjectInfo {
    /** Project name (from .csproj filename) */
    name: string;

    /** Full path to the .csproj file */
    csprojPath: string;

    /** Directory containing the .csproj */
    projectDir: string;

    /** Detected project type */
    projectType: 'api' | 'web' | 'library' | 'unknown';

    /** List of publish profiles found for this project */
    profiles: PublishProfileInfo[];

    /** Target framework (e.g., net8.0, net6.0) extracted from .csproj */
    targetFramework?: string;
}

export interface WorkspaceStructure {
    /** All discovered projects */
    projects: ProjectInfo[];

    /** Whether the workspace has a typical Server/Client structure */
    hasServerClientStructure: boolean;
}
