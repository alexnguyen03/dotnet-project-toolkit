import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { PublishProfileInfo } from '../models/ProjectModels';
import { runProcess } from '../utils/ProcessRunner';
import { withTimestampedAppendLine } from '../utils/OutputChannelTimestamp';

/**
 * Log Viewer Service Interface
 * Handles fetching and opening remote IIS logs
 */
export interface ILogViewerService {
	viewLogs(profileInfo: PublishProfileInfo, password: string, lineCount?: number): Promise<void>;
	viewQuickLogs(
		profileInfo: PublishProfileInfo,
		password: string,
		lineCount?: number
	): Promise<void>;
}

/**
 * Log Viewer Service Implementation
 * Uses MSDeploy to download logs from remote IIS server
 */
export class LogViewerService implements ILogViewerService {
	private outputChannel: vscode.OutputChannel;
	private currentProfileInfo: PublishProfileInfo | null = null;

	constructor(private readonly extensionOutputChannel: vscode.OutputChannel) {
		this.outputChannel = withTimestampedAppendLine(
			vscode.window.createOutputChannel('IIS Logs - Quick View')
		);
	}

	async viewLogs(
		profileInfo: PublishProfileInfo,
		password: string,
		lineCount: number = 100
	): Promise<void> {
		this.currentProfileInfo = profileInfo;

		try {
			this.log('Fetching logs from IIS server via MSDeploy...');
			const tempDir = path.join(os.tmpdir(), 'iis-logs', profileInfo.siteName || 'default');
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			await this.downloadLogsViaMSDeploy(
				profileInfo.publishUrl || '',
				profileInfo.siteName || '',
				profileInfo.userName || '',
				password,
				tempDir
			);

			const logFilePath = this.getLatestLogFilePath(tempDir);
			if (logFilePath) {
				const document = await vscode.workspace.openTextDocument(logFilePath);
				await vscode.window.showTextDocument(document, {
					preview: false,
					viewColumn: vscode.ViewColumn.One,
				});

				this.log(`Opened log file: ${logFilePath}`);
				vscode.window.showInformationMessage(`Log file opened: ${path.basename(logFilePath)}`);
			} else {
				this.log('No log files found.');
				vscode.window.showWarningMessage('No logs found on the server.');
			}
		} catch (error: any) {
			this.log(`Error fetching logs: ${error.message}`);
			vscode.window.showErrorMessage(`Failed to fetch logs: ${error.message}`);
		}
	}

	async viewQuickLogs(
		profileInfo: PublishProfileInfo,
		password: string,
		lineCount: number = 200
	): Promise<void> {
		this.currentProfileInfo = profileInfo;

		try {
			this.log('Fetching quick log preview from IIS server...');
			this.outputChannel.clear();
			this.outputChannel.show();
			this.outputChannel.appendLine('='.repeat(80));
			this.outputChannel.appendLine(`Quick Log Preview: ${profileInfo.siteName}`);
			this.outputChannel.appendLine(`Server: ${profileInfo.publishUrl}`);
			this.outputChannel.appendLine(`Preview Lines: ${lineCount}`);
			this.outputChannel.appendLine('='.repeat(80));
			this.outputChannel.appendLine('');

			const tempDir = path.join(os.tmpdir(), 'iis-logs', profileInfo.siteName || 'default');
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			await this.downloadLogsViaMSDeploy(
				profileInfo.publishUrl || '',
				profileInfo.siteName || '',
				profileInfo.userName || '',
				password,
				tempDir
			);

			const logFilePath = this.getLatestLogFilePath(tempDir);
			if (logFilePath) {
				const preview = this.readLogPreview(logFilePath, lineCount);
				this.outputChannel.appendLine(preview);
				this.outputChannel.appendLine('');
				this.outputChannel.appendLine('='.repeat(80));
				this.outputChannel.appendLine(`Full log file: ${logFilePath}`);
				this.outputChannel.appendLine('Tip: Click the file path above to open the complete log file');
				this.outputChannel.appendLine('='.repeat(80));

				this.log('Quick log preview displayed');
				vscode.window
					.showInformationMessage(
						'Quick log preview ready. Check "IIS Logs - Quick View" output.',
						'Open Full File'
					)
					.then((selection) => {
						if (selection === 'Open Full File') {
							vscode.workspace.openTextDocument(logFilePath).then((doc) => {
								vscode.window.showTextDocument(doc, {
									preview: false,
									viewColumn: vscode.ViewColumn.One,
								});
							});
						}
					});
			} else {
				this.outputChannel.appendLine('No log files found.');
				this.log('No log files found.');
				vscode.window.showWarningMessage('No logs found on the server.');
			}
		} catch (error: any) {
			this.log(`Error fetching quick logs: ${error.message}`);
			this.outputChannel.appendLine('');
			this.outputChannel.appendLine('ERROR: ' + error.message);
			vscode.window.showErrorMessage(`Failed to fetch logs: ${error.message}`);
		}
	}

	private async downloadLogsViaMSDeploy(
		publishUrl: string,
		siteName: string,
		userName: string,
		password: string,
		destDir: string
	): Promise<void> {
		this.log(`Downloading logs via MSDeploy from ${publishUrl}...`);

		const msdeployPath = this.findMsDeployPath();
		if (!msdeployPath) {
			throw new Error(
				'MSDeploy (msdeploy.exe) not found. Please install Web Deploy from https://www.iis.net/downloads/microsoft/web-deploy'
			);
		}

		const profileInfo = this.getCurrentProfileInfo();
		if (!profileInfo?.logPath) {
			throw new Error(
				'Log path not configured. Please set the log path in profile settings (e.g., D:\\www\\site\\logs\\stdout)'
			);
		}

		const logPath = profileInfo.logPath;
		this.log(`Using log path from profile: ${logPath}`);

		let serverUrl = publishUrl;
		if (!serverUrl.includes(':')) {
			serverUrl = `${serverUrl}:8172`;
			this.log(`Added default port 8172: ${serverUrl}`);
		}

		const computerName = `https://${serverUrl}/msdeploy.axd?site=${siteName}`;
		this.log(`MSDeploy computerName: ${computerName}`);
		this.log('Executing MSDeploy sync...');

		const result = await runProcess(
			msdeployPath,
			[
				'-verb:sync',
				`-source:dirPath=${logPath},computerName=${computerName},userName=${userName},password=${password},authType=Basic`,
				`-dest:dirPath=${destDir}`,
				'-allowUntrusted',
				'-verbose',
			],
			{
				timeoutMs: 60000,
				maxOutputBytes: 10 * 1024 * 1024,
				onStdout: (text) => {
					if (text.trim()) {
						this.log(`MSDeploy output: ${text.trim()}`);
					}
				},
				onStderr: (text) => {
					if (text.trim() && !text.includes('Info:')) {
						this.log(`MSDeploy stderr: ${text.trim()}`);
					}
				},
			}
		);

		if (result.exitCode !== 0) {
			throw new Error(`Failed to download logs via MSDeploy: ${result.output}`);
		}

		this.log('Logs downloaded successfully');
	}

	private getCurrentProfileInfo(): PublishProfileInfo | null {
		return this.currentProfileInfo;
	}

	private findMsDeployPath(): string | null {
		const commonPaths = [
			'C:\\Program Files\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe',
			'C:\\Program Files (x86)\\IIS\\Microsoft Web Deploy V3\\msdeploy.exe',
			'C:\\Program Files\\IIS\\Microsoft Web Deploy V4\\msdeploy.exe',
			'C:\\Program Files (x86)\\IIS\\Microsoft Web Deploy V4\\msdeploy.exe',
		];

		for (const msdeployPath of commonPaths) {
			if (fs.existsSync(msdeployPath)) {
				this.log(`Found msdeploy.exe at: ${msdeployPath}`);
				return msdeployPath;
			}
		}

		try {
			const stdout = require('child_process').execSync('where msdeploy.exe', {
				encoding: 'utf-8',
			});
			const foundPath = stdout.trim().split('\n')[0];
			if (foundPath && fs.existsSync(foundPath)) {
				this.log(`Found msdeploy.exe in PATH: ${foundPath}`);
				return foundPath;
			}
		} catch {
			// Not in PATH
		}

		this.log('msdeploy.exe not found in common locations');
		return null;
	}

	private getLatestLogFilePath(logDir: string): string | null {
		try {
			if (!fs.existsSync(logDir)) {
				this.log('Log directory not found locally.');
				return null;
			}

			const files = fs
				.readdirSync(logDir)
				.filter((f) => f.endsWith('.log'))
				.map((f) => {
					const filePath = path.join(logDir, f);
					const stats = fs.statSync(filePath);
					return {
						name: f,
						path: filePath,
						mtime: stats.mtime,
					};
				})
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

			if (files.length === 0) {
				this.log('No log files found.');
				return null;
			}

			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const todayLogs = files.filter((f) => {
				const fileDate = new Date(f.mtime);
				fileDate.setHours(0, 0, 0, 0);
				return fileDate.getTime() === today.getTime();
			});

			let latestLog;
			if (todayLogs.length > 0) {
				latestLog = todayLogs[0];
				this.log(`Found today's log: ${latestLog.name}`);
			} else {
				latestLog = files[0];
				this.log(
					`No today's logs found, using latest: ${latestLog.name} (${latestLog.mtime.toLocaleDateString()})`
				);
			}

			return latestLog.path;
		} catch (error: any) {
			this.log(`Error finding log file: ${error.message}`);
			return null;
		}
	}

	private readLogPreview(logFilePath: string, lineCount: number): string {
		try {
			const logDir = path.dirname(logFilePath);
			const currentFileName = path.basename(logFilePath);

			const allLogFiles = fs
				.readdirSync(logDir)
				.filter((f) => f.endsWith('.log'))
				.map((f) => {
					const filePath = path.join(logDir, f);
					const stats = fs.statSync(filePath);
					return {
						name: f,
						size: (stats.size / 1024).toFixed(2),
						mtime: stats.mtime,
						isCurrent: f === currentFileName,
					};
				})
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

			const stats = fs.statSync(logFilePath);
			const content = fs.readFileSync(logFilePath, 'utf-8');
			const lines = content.split('\n');
			const lastLines = lines.slice(-lineCount);

			const fileSize = (stats.size / 1024).toFixed(2);
			const lastModified = stats.mtime.toLocaleString();

			const fileListLines = allLogFiles.map((f) => {
				const marker = f.isCurrent ? '>' : ' ';
				const dateStr = f.mtime.toLocaleString();
				return `${marker} ${f.name} (${f.size} KB) - ${dateStr}`;
			});

			return [
				'Available Log Files:',
				'-'.repeat(80),
				...fileListLines,
				'',
				'='.repeat(80),
				`Currently Viewing: ${currentFileName}`,
				`Size: ${fileSize} KB`,
				`Last Modified: ${lastModified}`,
				`Showing last ${lastLines.length} of ${lines.length} lines`,
				'',
				'-'.repeat(80),
				'',
				...lastLines,
			].join('\n');
		} catch (error: any) {
			this.log(`Error reading log preview: ${error.message}`);
			return `Error reading log file: ${error.message}`;
		}
	}

	private log(message: string): void {
		this.extensionOutputChannel.appendLine(`[LogViewerService] ${message}`);
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}
