import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { runProcess } from '../utils/ProcessRunner';

export interface RollbackResult {
	success: boolean;
	errorMessage?: string;
	output?: string;
}

export interface IRollbackService {
	createBackup(projectPath: string, profileInfo: PublishProfileInfo): Promise<string | null>;
	rollback(
		projectPath: string,
		projectName: string,
		profileInfo: PublishProfileInfo,
		password: string,
		backupPath: string
	): Promise<RollbackResult>;
}

export class RollbackService implements IRollbackService {
	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly passwordStorage: IPasswordStorage
	) {}

	async createBackup(
		projectPath: string,
		profileInfo: PublishProfileInfo
	): Promise<string | null> {
		try {
			const projectDir = path.dirname(projectPath);
			const publishDir = path.join(projectDir, 'bin', 'Release', 'publish');

			if (!fs.existsSync(publishDir)) {
				this.outputChannel.appendLine('[Rollback] No published output found to backup');
				return null;
			}

			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const backupDir = path.join(
				os.tmpdir(),
				'dotnet-toolkit-backups',
				profileInfo.siteName || 'default',
				timestamp
			);

			if (!fs.existsSync(backupDir)) {
				fs.mkdirSync(backupDir, { recursive: true });
			}

			this.outputChannel.appendLine(`[Rollback] Creating backup at: ${backupDir}`);
			await this.copyDirectory(publishDir, backupDir);
			this.outputChannel.appendLine('[Rollback] Backup created successfully');
			return backupDir;
		} catch (error: any) {
			this.outputChannel.appendLine(`[Rollback] Failed to create backup: ${error.message}`);
			return null;
		}
	}

	async rollback(
		projectPath: string,
		projectName: string,
		profileInfo: PublishProfileInfo,
		password: string,
		backupPath: string
	): Promise<RollbackResult> {
		try {
			if (!fs.existsSync(backupPath)) {
				return {
					success: false,
					errorMessage: `Backup path does not exist: ${backupPath}`,
				};
			}

			const projectDir = path.dirname(projectPath);
			const publishDir = path.join(projectDir, 'bin', 'Release', 'publish');

			this.outputChannel.appendLine(`[Rollback] Restoring from: ${backupPath}`);
			this.outputChannel.appendLine(`[Rollback] Target: ${publishDir}`);

			if (fs.existsSync(publishDir)) {
				fs.rmSync(publishDir, { recursive: true, force: true });
			}

			await this.copyDirectory(backupPath, publishDir);
			this.outputChannel.appendLine('[Rollback] Restored published files successfully');

			this.outputChannel.appendLine('[Rollback] Deploying restored files to server...');
			const deployResult = await this.deployBackup(projectPath, profileInfo, password);

			return {
				success: deployResult.exitCode === 0,
				output: deployResult.output,
				errorMessage: deployResult.exitCode !== 0 ? 'Deployment failed' : undefined,
			};
		} catch (error: any) {
			this.outputChannel.appendLine(`[Rollback] Failed: ${error.message}`);
			return {
				success: false,
				errorMessage: error.message,
			};
		}
	}

	private async deployBackup(
		projectPath: string,
		profileInfo: PublishProfileInfo,
		password: string
	): Promise<{ exitCode: number; output: string }> {
		const secureResult = await runProcess(
			'dotnet',
			[
				'publish',
				projectPath,
				`/p:PublishProfile=${profileInfo.fileName}`,
				'/p:Password=$(DOTNET_PUBLISH_PASSWORD)',
				'/p:Configuration=Release',
			],
			{
				cwd: path.dirname(projectPath),
				env: {
					...process.env,
					DOTNET_PUBLISH_PASSWORD: password,
				},
				maxOutputBytes: 10 * 1024 * 1024,
				onStdout: (text) => {
					this.outputChannel.append(text);
				},
				onStderr: (text) => {
					this.outputChannel.append(text);
				},
			}
		);
		let result = secureResult;

		if (secureResult.exitCode !== 0) {
			this.outputChannel.appendLine(
				'[Rollback] Secure password injection failed, retrying with inline password property for compatibility...'
			);
			result = await runProcess(
				'dotnet',
				[
					'publish',
					projectPath,
					`/p:PublishProfile=${profileInfo.fileName}`,
					`/p:Password=${password}`,
					'/p:Configuration=Release',
				],
				{
					cwd: path.dirname(projectPath),
					env: {
						...process.env,
					},
					maxOutputBytes: 10 * 1024 * 1024,
					onStdout: (text) => {
						this.outputChannel.append(text);
					},
					onStderr: (text) => {
						this.outputChannel.append(text);
					},
				}
			);
		}

		if (result.timedOut) {
			this.outputChannel.appendLine('[Rollback] Deployment timed out');
		}

		return {
			exitCode: result.exitCode,
			output: result.output,
		};
	}

	private async copyDirectory(src: string, dest: string): Promise<void> {
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}

		const entries = fs.readdirSync(src, { withFileTypes: true });
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				await this.copyDirectory(srcPath, destPath);
			} else {
				fs.copyFileSync(srcPath, destPath);
			}
		}
	}
}
