import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';
import { PublishProfileInfo } from '../models/ProjectModels';

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
                isProduction: environment === 'production',
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
    private detectEnvironmentFromXml(environmentName: string | undefined): 'staging' | 'production' | 'dev' | null {
        if (!environmentName) {
            return null;
        }

        const lowerName = environmentName.toLowerCase();

        if (lowerName === 'production') {
            return 'production';
        }
        if (lowerName === 'staging' || lowerName === 'staging') {
            return 'staging';
        }
        if (lowerName === 'development' || lowerName === 'dev') {
            return 'dev';
        }

        return null;
    }

    /**
     * Detect environment from profile filename
     * Examples: "uat-api" -> "uat", "prod-web" -> "prod"
     */
    private detectEnvironment(fileName: string): 'staging' | 'production' | 'dev' | 'unknown' {
        const lowerName = fileName.toLowerCase();

        if (lowerName.includes('prod') || lowerName.includes('production')) {
            return 'production';
        }
        if (lowerName.includes('staging')) {
            return 'staging';
        }
        if (lowerName.includes('dev') || lowerName.includes('development')) {
            return 'dev';
        }

        return 'unknown';
    }

    /**
     * Format display name for the profile
     * Examples: "uat-api" -> "uat-api [UAT]", "prod-web" -> "prod-web [PROD]"
     */
    private formatDisplayName(fileName: string, environment: string): string {
        const envLabel = environment.toUpperCase();

        if (environment === 'unknown') {
            return fileName;
        }

        return `${fileName} [${envLabel}]`;
    }
}
