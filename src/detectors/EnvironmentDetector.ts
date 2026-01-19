import { DeployEnvironment } from '../models/ProjectModels';

/**
 * Environment Detector Service
 * Handles environment detection logic from various sources
 * Follows Single Responsibility Principle
 */
export interface IEnvironmentDetector {
    /**
     * Detect environment from XML EnvironmentName field
     */
    detectFromXml(environmentName: string | undefined): DeployEnvironment | null;

    /**
     * Detect environment from profile filename
     */
    detectFromFileName(fileName: string): DeployEnvironment;
}

/**
 * Environment Detector Implementation
 */
export class EnvironmentDetector implements IEnvironmentDetector {
    detectFromXml(environmentName: string | undefined): DeployEnvironment | null {
        if (!environmentName) {
            return null;
        }

        const lower = environmentName.toLowerCase();

        if (lower === 'production' || lower === 'prod') {
            return DeployEnvironment.Production;
        }
        if (lower === 'staging' || lower === 'uat') {
            return DeployEnvironment.Staging;
        }
        if (lower === 'development' || lower === 'dev') {
            return DeployEnvironment.Development;
        }

        return null;
    }

    detectFromFileName(fileName: string): DeployEnvironment {
        const lower = fileName.toLowerCase();

        if (lower.includes('production') || lower.includes('prod')) {
            return DeployEnvironment.Production;
        }
        if (lower.includes('staging') || lower.includes('uat')) {
            return DeployEnvironment.Staging;
        }
        if (lower.includes('dev') || lower.includes('development')) {
            return DeployEnvironment.Development;
        }

        return DeployEnvironment.Unknown;
    }
}
