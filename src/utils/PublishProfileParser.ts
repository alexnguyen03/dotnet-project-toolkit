import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { PublishProfileInfo, DeployEnvironment } from '../models/ProjectModels';

/**
 * Parser for .NET publish profile (.pubxml) files
 */
export class PublishProfileParser {
    private xmlParser: XMLParser;

    constructor() {
        this.xmlParser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
        });
    }

    /**
     * Parse a .pubxml file and extract profile information
     */
    parseProfile(pubxmlPath: string): PublishProfileInfo | null {
        try {
            if (!fs.existsSync(pubxmlPath)) {
                return null;
            }

            const xmlContent = fs.readFileSync(pubxmlPath, 'utf-8');
            const parsed = this.xmlParser.parse(xmlContent);

            const fileName = path.basename(pubxmlPath, '.pubxml');

            // Extract properties from PropertyGroup
            const propertyGroup = parsed?.Project?.PropertyGroup;
            const publishUrl = propertyGroup?.PublishUrl || propertyGroup?.MSDeployServiceURL;
            const publishMethod = propertyGroup?.WebPublishMethod || propertyGroup?.PublishProvider;
            const environmentName = propertyGroup?.EnvironmentName;
            const siteUrl = propertyGroup?.SiteUrlToLaunchAfterPublish;
            const siteName = propertyGroup?.DeployIisAppPath || propertyGroup?.MsDeployAppPath;
            const userName = propertyGroup?.UserName;

            // Detect environment from EnvironmentName field first, fallback to filename
            const environment = this.detectEnvironmentFromXml(environmentName) || this.detectEnvironment(fileName);

            return {
                name: this.formatDisplayName(fileName, environment),
                path: pubxmlPath,
                fileName: fileName,
                environment: environment,
                isProduction: environment === DeployEnvironment.Production,
                publishUrl: publishUrl,
                publishMethod: publishMethod,
                siteUrl: siteUrl,
                siteName: siteName,
                userName: userName
            };
        } catch (error) {
            console.error(`Failed to parse publish profile ${pubxmlPath}:`, error);
            return null;
        }
    }

    /**
     * Detect environment from XML EnvironmentName field
     */
    private detectEnvironmentFromXml(environmentName: string | undefined): DeployEnvironment | null {
        if (!environmentName) {
            return null;
        }

        const lowerName = environmentName.toLowerCase();

        if (lowerName === 'production') {
            return DeployEnvironment.Production;
        }
        if (lowerName === 'staging' || lowerName === 'uat') {
            return DeployEnvironment.Staging;
        }
        if (lowerName === 'development' || lowerName === 'dev') {
            return DeployEnvironment.Development;
        }

        return null;
    }

    /**
     * Detect environment from profile filename
     * Examples: "uat-api" -> "uat", "prod-web" -> "prod"
     */
    private detectEnvironment(fileName: string): DeployEnvironment {
        const lowerName = fileName.toLowerCase();

        if (lowerName.includes('prod') || lowerName.includes('production')) {
            return DeployEnvironment.Production;
        }
        if (lowerName.includes('staging') || lowerName.includes('uat')) {
            return DeployEnvironment.Staging;
        }
        if (lowerName.includes('dev') || lowerName.includes('development')) {
            return DeployEnvironment.Development;
        }

        return DeployEnvironment.Unknown;
    }

    /**
     * Format display name for the profile
     * Examples: "uat-api" -> "uat-api [UAT]", "prod-web" -> "prod-web [PROD]"
     */
    private formatDisplayName(fileName: string, environment: DeployEnvironment): string {
        return fileName;
    }
}
