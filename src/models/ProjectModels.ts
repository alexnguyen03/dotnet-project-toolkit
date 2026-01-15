/**
 * Model definitions for .NET projects and publish profiles
 */

export interface PublishProfileInfo {
    /** Display name for the profile (e.g., "uat-api [UAT]") */
    name: string;
    
    /** Full path to the .pubxml file */
    path: string;
    
    /** Base filename without extension (e.g., "uat-api") */
    fileName: string;
    
    /** Detected environment type */
    environment: 'uat' | 'prod' | 'dev' | 'unknown';
    
    /** Whether this is a production profile */
    isProduction: boolean;
    
    /** Publish URL from the profile (optional) */
    publishUrl?: string;
    
    /** Web deploy method (e.g., MSDeploy) */
    publishMethod?: string;
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
}

export interface WorkspaceStructure {
    /** All discovered projects */
    projects: ProjectInfo[];
    
    /** Whether the workspace has a typical Server/Client structure */
    hasServerClientStructure: boolean;
}
