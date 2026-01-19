import { ProfileWizardData } from '../services/ProfileService';
import { DeployEnvironment } from '../models/ProjectModels';
import { GuidGenerator } from '../utils/GuidGenerator';

/**
 * Profile XML Generator Service
 * Generates .pubxml file content from profile data
 * Follows Single Responsibility Principle
 */
export interface IProfileXmlGenerator {
    /**
     * Generate .pubxml XML content
     */
    generate(data: ProfileWizardData, targetFramework: string): string;
}

/**
 * Profile XML Generator Implementation
 */
export class ProfileXmlGenerator implements IProfileXmlGenerator {
    generate(data: ProfileWizardData, targetFramework: string): string {
        const siteUrl = data.siteUrl || `https://${data.publishUrl}`;
        const guid = GuidGenerator.generate();
        const envName = this.mapEnvironmentName(data.environment);

        return `<?xml version="1.0" encoding="utf-8"?>
<!-- https://go.microsoft.com/fwlink/?LinkID=208121. -->
<Project>
  <PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <LaunchSiteAfterPublish>${data.openBrowserOnDeploy !== false}</LaunchSiteAfterPublish>
    <EnableStdoutLog>${data.enableStdoutLog === true}</EnableStdoutLog>
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

    private mapEnvironmentName(environment: DeployEnvironment): string {
        switch (environment) {
            case DeployEnvironment.Production:
                return 'Production';
            case DeployEnvironment.Staging:
                return 'Staging';
            case DeployEnvironment.Development:
                return 'Development';
            default:
                return 'Development';
        }
    }
}
