import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { ProjectInfo, PublishProfileInfo, DeployEnvironment } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';

/**
 * Profile wizard input data
 */
export interface ProfileWizardData {
    profileName: string;
    environment: DeployEnvironment;
    publishUrl: string;
    siteName: string;
    username: string;
    password: string;
    siteUrl?: string;
    openBrowserOnDeploy?: boolean;
}

/**
 * Profile Service Interface - Single Responsibility
 * Handles all profile-related operations
 */
export interface IProfileService {
    create(projectInfo: ProjectInfo, data: ProfileWizardData, overwrite?: boolean): Promise<string | null>;
    delete(profileInfo: PublishProfileInfo): Promise<boolean>;
    parse(pubxmlPath: string): PublishProfileInfo | null;
    detectTargetFramework(csprojPath: string): Promise<string>;
}

/**
 * Profile Service Implementation
 * Follows SRP - only handles profile CRUD operations
 */
export class ProfileService implements IProfileService {
    private readonly xmlParser: XMLParser;

    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly passwordStorage: IPasswordStorage
    ) {
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            parseTagValue: true, // Attempt to parse values (numbers, booleans)
            trimValues: true
        });
    }

    async create(projectInfo: ProjectInfo, data: ProfileWizardData, overwrite: boolean = false): Promise<string | null> {
        try {
            // Detect .NET version
            const targetFramework = await this.detectTargetFramework(projectInfo.csprojPath);

            // Generate XML content
            const content = this.generatePubxmlContent(data, targetFramework);

            // Save file
            const pubxmlPath = await this.savePubxmlFile(projectInfo, data.profileName, content, overwrite);
            if (!pubxmlPath) {
                return null;
            }

            // Store password
            const passwordKey = this.passwordStorage.generateKey(projectInfo.name, data.profileName);
            await this.passwordStorage.store(passwordKey, data.password);

            this.log(`Created profile: ${pubxmlPath}`);
            this.log(`Password key: ${passwordKey}`);

            return pubxmlPath;
        } catch (error) {
            this.log(`Error creating profile: ${error}`);
            return null;
        }
    }

    async delete(profileInfo: PublishProfileInfo): Promise<boolean> {
        try {
            if (fs.existsSync(profileInfo.path)) {
                fs.unlinkSync(profileInfo.path);
                this.log(`Deleted: ${profileInfo.path}`);
            }
            return true;
        } catch (error) {
            this.log(`Error deleting: ${error}`);
            return false;
        }
    }

    parse(pubxmlPath: string): PublishProfileInfo | null {
        try {
            if (!fs.existsSync(pubxmlPath)) {
                return null;
            }

            const content = fs.readFileSync(pubxmlPath, 'utf-8');
            const parsed = this.xmlParser.parse(content);
            let props = parsed?.Project?.PropertyGroup;
            if (Array.isArray(props)) {
                // Find group with WebPublishMethod or fallback to first
                props = props.find((p: any) => p.WebPublishMethod) || props[0];
            }

            const fileName = path.basename(pubxmlPath, '.pubxml');
            const envName = props?.EnvironmentName;
            const environment = this.detectEnvironment(envName, fileName);

            // Determine openBrowserOnDeploy:
            // - If tag missing: undefined (falls back to global)
            // - If 'true': true
            // - If 'false': false
            if (props) {
                 // Debug props structure
                 this.log(`[Parse] Props keys: ${JSON.stringify(Object.keys(props))}`);
            }

            let openBrowserOnDeploy: boolean | undefined = undefined;
            if (props?.LaunchSiteAfterPublish !== undefined) {
                 const val = props.LaunchSiteAfterPublish;
                 this.log(`[Parse] ${fileName}: LaunchSiteAfterPublish = ${val} (type: ${typeof val})`);
                 
                 if (typeof val === 'boolean') {
                     openBrowserOnDeploy = val;
                 } else if (typeof val === 'string') {
                     const lower = val.toLowerCase();
                     if (lower === 'true') openBrowserOnDeploy = true;
                     if (lower === 'false') openBrowserOnDeploy = false;
                 }
            } else {
                 this.log(`[Parse] ${fileName}: LaunchSiteAfterPublish is missing/undefined`);
            }

            return {
                name: this.formatDisplayName(fileName, environment),
                path: pubxmlPath,
                fileName,
                environment,
                isProduction: environment === DeployEnvironment.Production,
                publishUrl: props?.MSDeployServiceURL || props?.PublishUrl,
                publishMethod: props?.WebPublishMethod,
                siteName: props?.DeployIisAppPath,
                siteUrl: props?.SiteUrlToLaunchAfterPublish,
                userName: props?.UserName,
                openBrowserOnDeploy
            };
        } catch (error) {
            this.log(`Error parsing ${pubxmlPath}: ${error}`);
            return null;
        }
    }

    async detectTargetFramework(csprojPath: string): Promise<string> {
        try {
            const content = fs.readFileSync(csprojPath, 'utf-8');
            const parsed = this.xmlParser.parse(content);
            const groups = parsed?.Project?.PropertyGroup;

            if (Array.isArray(groups)) {
                for (const g of groups) {
                    if (g.TargetFramework) return g.TargetFramework;
                }
            } else if (groups?.TargetFramework) {
                return groups.TargetFramework;
            }
            return 'net8.0';
        } catch {
            return 'net8.0';
        }
    }

    private generatePubxmlContent(data: ProfileWizardData, targetFramework: string): string {
        const siteUrl = data.siteUrl || `https://${data.publishUrl}`;
        const guid = this.generateGuid();
        const envName = data.environment === DeployEnvironment.Production ? 'Production' : (data.environment === DeployEnvironment.Staging ? 'Staging' : 'Development');

        return `<?xml version="1.0" encoding="utf-8"?>
<!-- https://go.microsoft.com/fwlink/?LinkID=208121. -->
<Project>
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <LaunchSiteAfterPublish>${data.openBrowserOnDeploy !== false}</LaunchSiteAfterPublish>
    <LastUsedBuildConfiguration>Release</LastUsedBuildConfiguration>
    <LastUsedPlatform>Any CPU</LastUsedPlatform>
    <SiteUrlToLaunchAfterPublish>${siteUrl}</SiteUrlToLaunchAfterPublish>
    <ExcludeApp_Data>false</ExcludeApp_Data>
    <ProjectGuid>${guid}</ProjectGuid>
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
    <EnvironmentName>${envName}</EnvironmentName>
    <TargetFramework>${targetFramework}</TargetFramework>
  </PropertyGroup>
</Project>
`;
    }

    private async savePubxmlFile(projectInfo: ProjectInfo, profileName: string, content: string, overwrite: boolean = false): Promise<string | null> {
        const dir = path.join(projectInfo.projectDir, 'Properties', 'PublishProfiles');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const filePath = path.join(dir, `${profileName}.pubxml`);

        if (fs.existsSync(filePath) && !overwrite) {
            const result = await vscode.window.showWarningMessage(
                `Profile "${profileName}" already exists. Overwrite?`,
                'Overwrite', 'Cancel'
            );
            if (result !== 'Overwrite') return null;
        }

        fs.writeFileSync(filePath, content, 'utf-8');
        return filePath;
    }

    private detectEnvironment(envName: string | undefined, fileName: string): DeployEnvironment {
        if (envName) {
            const lower = envName.toLowerCase();
            if (lower === 'production' || lower === 'prod') return DeployEnvironment.Production;
            if (lower === 'staging' || lower === 'uat') return DeployEnvironment.Staging;
            if (lower === 'development' || lower === 'dev') return DeployEnvironment.Development;
        }

        const lower = fileName.toLowerCase();
        if (lower.includes('production') || lower.includes('prod')) return DeployEnvironment.Production;
        if (lower.includes('staging') || lower.includes('uat')) return DeployEnvironment.Staging;
        if (lower.includes('dev')) return DeployEnvironment.Development;
        return DeployEnvironment.Unknown;
    }

    private formatDisplayName(fileName: string, env: DeployEnvironment): string {
        return fileName;
    }

    private generateGuid(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[ProfileService] ${message}`);
    }
}
