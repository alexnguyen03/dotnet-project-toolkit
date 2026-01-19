import { IXmlParser } from '../parsers/IXmlParser';
import { IFileSystemRepository } from '../repositories/IFileSystemRepository';

/**
 * Project Analyzer Service
 * Analyzes .csproj files to extract project information
 * Follows Single Responsibility Principle
 */
export interface IProjectAnalyzer {
    /**
     * Detect target framework from .csproj file
     */
    detectTargetFramework(csprojPath: string): Promise<string>;
}

/**
 * Project Analyzer Implementation
 */
export class ProjectAnalyzer implements IProjectAnalyzer {
    constructor(
        private readonly xmlParser: IXmlParser,
        private readonly fileSystem: IFileSystemRepository
    ) {}

    async detectTargetFramework(csprojPath: string): Promise<string> {
        try {
            const content = await this.fileSystem.readFile(csprojPath);
            const parsed = this.xmlParser.parse(content);
            const groups = parsed?.Project?.PropertyGroup;

            if (Array.isArray(groups)) {
                for (const g of groups) {
                    if (g.TargetFramework) {
                        return g.TargetFramework;
                    }
                }
            } else if (groups?.TargetFramework) {
                return groups.TargetFramework;
            }

            return 'net8.0'; // Default fallback
        } catch {
            return 'net8.0'; // Default fallback on error
        }
    }
}
