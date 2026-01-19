import * as vscode from 'vscode';
import * as path from 'path';
import { ProjectInfo } from '../models/ProjectModels';
import { IFileSystemRepository } from './IFileSystemRepository';

/**
 * Profile Repository Interface
 * Handles file operations for publish profiles
 * Follows Repository Pattern
 */
export interface IProfileRepository {
	/**
	 * Save profile to .pubxml file
	 */
	save(
		projectInfo: ProjectInfo,
		profileName: string,
		content: string,
		overwrite?: boolean
	): Promise<string | null>;

	/**
	 * Delete profile file
	 */
	delete(profilePath: string): Promise<boolean>;

	/**
	 * Get profile file path
	 */
	getProfilePath(projectInfo: ProjectInfo, profileName: string): string;
}

/**
 * Profile Repository Implementation
 */
export class ProfileRepository implements IProfileRepository {
	constructor(private readonly fileSystem: IFileSystemRepository) {}

	async save(
		projectInfo: ProjectInfo,
		profileName: string,
		content: string,
		overwrite: boolean = false
	): Promise<string | null> {
		const dir = path.join(projectInfo.projectDir, 'Properties', 'PublishProfiles');

		if (!this.fileSystem.exists(dir)) {
			await this.fileSystem.ensureDirectory(dir);
		}

		const filePath = this.getProfilePath(projectInfo, profileName);

		if (this.fileSystem.exists(filePath) && !overwrite) {
			const result = await vscode.window.showWarningMessage(
				`Profile "${profileName}" already exists. Overwrite?`,
				'Overwrite',
				'Cancel'
			);
			if (result !== 'Overwrite') {
				return null;
			}
		}

		await this.fileSystem.writeFile(filePath, content);
		return filePath;
	}

	async delete(profilePath: string): Promise<boolean> {
		try {
			if (this.fileSystem.exists(profilePath)) {
				await this.fileSystem.deleteFile(profilePath);
			}
			return true;
		} catch (error) {
			return false;
		}
	}

	getProfilePath(projectInfo: ProjectInfo, profileName: string): string {
		return path.join(
			projectInfo.projectDir,
			'Properties',
			'PublishProfiles',
			`${profileName}.pubxml`
		);
	}
}
