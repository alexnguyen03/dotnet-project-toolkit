import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectInfo, PublishProfileInfo, DeployEnvironment } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { IXmlParser } from '../parsers/IXmlParser';
import { IFileSystemRepository } from '../repositories/IFileSystemRepository';
import { IProjectAnalyzer } from '../analyzers/ProjectAnalyzer';
import { IProfileXmlGenerator } from '../generators/ProfileXmlGenerator';
import { IProfileRepository } from '../repositories/ProfileRepository';
import { IEnvironmentDetector } from '../detectors/EnvironmentDetector';

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
	enableStdoutLog?: boolean;
	logPath?: string;
}

/**
 * Profile Service Interface - Single Responsibility
 * Handles all profile-related operations
 */
export interface IProfileService {
	create(
		projectInfo: ProjectInfo,
		data: ProfileWizardData,
		overwrite?: boolean
	): Promise<string | null>;
	delete(profileInfo: PublishProfileInfo): Promise<boolean>;
	parse(pubxmlPath: string): PublishProfileInfo | null;
	detectTargetFramework(csprojPath: string): Promise<string>;
}

/**
 * Profile Service Implementation - Refactored
 * Now follows SRP by delegating to specialized services
 * Acts as a coordinator/orchestrator for profile operations
 */
export class ProfileService implements IProfileService {
	constructor(
		private readonly xmlParser: IXmlParser,
		private readonly fileSystem: IFileSystemRepository,
		private readonly projectAnalyzer: IProjectAnalyzer,
		private readonly xmlGenerator: IProfileXmlGenerator,
		private readonly profileRepository: IProfileRepository,
		private readonly environmentDetector: IEnvironmentDetector,
		private readonly passwordStorage: IPasswordStorage,
		private readonly outputChannel: vscode.OutputChannel
	) {}

	async create(
		projectInfo: ProjectInfo,
		data: ProfileWizardData,
		overwrite: boolean = false
	): Promise<string | null> {
		try {
			// Detect .NET version using ProjectAnalyzer
			const targetFramework = await this.projectAnalyzer.detectTargetFramework(
				projectInfo.csprojPath
			);

			// Generate XML content using ProfileXmlGenerator
			const content = this.xmlGenerator.generate(data, targetFramework);

			// Save file using ProfileRepository
			const pubxmlPath = await this.profileRepository.save(
				projectInfo,
				data.profileName,
				content,
				overwrite
			);
			if (!pubxmlPath) {
				return null;
			}

			// Store password
			const passwordKey = this.passwordStorage.generateKey(
				projectInfo.name,
				data.profileName
			);
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
			const success = await this.profileRepository.delete(profileInfo.path);
			if (success) {
				this.log(`Deleted: ${profileInfo.path}`);
			}
			return success;
		} catch (error) {
			this.log(`Error deleting: ${error}`);
			return false;
		}
	}

	parse(pubxmlPath: string): PublishProfileInfo | null {
		try {
			if (!this.fileSystem.exists(pubxmlPath)) {
				return null;
			}

			const content = this.fileSystem.readFileSync(pubxmlPath);
			const parsed = this.xmlParser.parse(content);
			let props = parsed?.Project?.PropertyGroup;
			if (Array.isArray(props)) {
				// Find group with WebPublishMethod or fallback to first
				props = props.find((p: any) => p.WebPublishMethod) || props[0];
			}

			const fileName = path.basename(pubxmlPath, '.pubxml');
			const envName = props?.EnvironmentName;

			// Use EnvironmentDetector for environment detection
			const environment =
				this.environmentDetector.detectFromXml(envName) ||
				this.environmentDetector.detectFromFileName(fileName);

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
				this.log(
					`[Parse] ${fileName}: LaunchSiteAfterPublish = ${val} (type: ${typeof val})`
				);

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

			// Parse enableStdoutLog
			let enableStdoutLog: boolean | undefined = undefined;
			if (props?.EnableStdoutLog !== undefined) {
				const val = props.EnableStdoutLog;
				if (typeof val === 'boolean') {
					enableStdoutLog = val;
				} else if (typeof val === 'string') {
					const lower = val.toLowerCase();
					if (lower === 'true') enableStdoutLog = true;
					if (lower === 'false') enableStdoutLog = false;
				}
			}

			return {
				name: fileName, // Simplified - no longer formatting display name here
				path: pubxmlPath,
				fileName,
				environment,
				isProduction: environment === DeployEnvironment.Production,
				publishUrl: props?.MSDeployServiceURL || props?.PublishUrl,
				publishMethod: props?.WebPublishMethod,
				siteName: props?.DeployIisAppPath,
				siteUrl: props?.SiteUrlToLaunchAfterPublish,
				userName: props?.UserName,
				openBrowserOnDeploy,
				enableStdoutLog,
				logPath: props?.LogPath,
			};
		} catch (error) {
			this.log(`Error parsing ${pubxmlPath}: ${error}`);
			return null;
		}
	}

	async detectTargetFramework(csprojPath: string): Promise<string> {
		// Delegate to ProjectAnalyzer
		return await this.projectAnalyzer.detectTargetFramework(csprojPath);
	}

	private log(message: string): void {
		this.outputChannel.appendLine(`[ProfileService] ${message}`);
	}
}
