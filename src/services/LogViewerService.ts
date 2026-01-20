import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PublishProfileInfo } from '../models/ProjectModels';

const execAsync = promisify(exec);

/**
 * Log Viewer Service Interface
 * Handles fetching and opening remote IIS logs
 */
export interface ILogViewerService {
	/**
	 * Fetch and open logs from remote IIS server directly in VS Code editor
	 * @param profileInfo Profile information containing server details
	 * @param password Deployment password for authentication
	 * @param lineCount Number of lines to fetch (deprecated - entire file is opened)
	 */
	viewLogs(profileInfo: PublishProfileInfo, password: string, lineCount?: number): Promise<void>;

	/**
	 * Quick log preview - Shows last ~200 lines in Output Channel with link to full file
	 * @param profileInfo Profile information containing server details
	 * @param password Deployment password for authentication
	 * @param lineCount Number of lines to preview (default: 200)
	 */
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

	constructor(private readonly extensionOutputChannel: vscode.OutputChannel) {
		// Create dedicated output channel for quick log previews
		this.outputChannel = vscode.window.createOutputChannel('IIS Logs - Quick View');
	}

	async viewLogs(
		profileInfo: PublishProfileInfo,
		password: string,
		lineCount: number = 100
	): Promise<void> {
		// Store profile info for use in downloadLogsViaMSDeploy
		this.currentProfileInfo = profileInfo;

		try {
			this.log('Fetching logs from IIS server via MSDeploy...');

			// Create temp directory for downloaded logs
			const tempDir = path.join(os.tmpdir(), 'iis-logs', profileInfo.siteName || 'default');

			// Ensure temp directory exists
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			// Download logs using MSDeploy
			await this.downloadLogsViaMSDeploy(
				profileInfo.publishUrl || '',
				profileInfo.siteName || '',
				profileInfo.userName || '',
				password,
				tempDir
			);

			// Get the latest log file path
			const logFilePath = this.getLatestLogFilePath(tempDir);

			// Open the log file directly in VS Code editor
			if (logFilePath) {
				const document = await vscode.workspace.openTextDocument(logFilePath);
				await vscode.window.showTextDocument(document, {
					preview: false,
					viewColumn: vscode.ViewColumn.One,
				});

				this.log(`✓ Opened log file: ${logFilePath}`);
				vscode.window.showInformationMessage(
					`Log file opened: ${path.basename(logFilePath)}`
				);
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
		// Store profile info for use in downloadLogsViaMSDeploy
		this.currentProfileInfo = profileInfo;

		try {
			this.log('Fetching quick log preview from IIS server...');
			this.outputChannel.clear();
			this.outputChannel.show();
			this.outputChannel.appendLine('='.repeat(80));
			this.outputChannel.appendLine(`📋 Quick Log Preview: ${profileInfo.siteName}`);
			this.outputChannel.appendLine(`Server: ${profileInfo.publishUrl}`);
			this.outputChannel.appendLine(`Preview Lines: ${lineCount}`);
			this.outputChannel.appendLine('='.repeat(80));
			this.outputChannel.appendLine('');

			// Create temp directory for downloaded logs
			const tempDir = path.join(os.tmpdir(), 'iis-logs', profileInfo.siteName || 'default');

			// Ensure temp directory exists
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}

			// Download logs using MSDeploy
			await this.downloadLogsViaMSDeploy(
				profileInfo.publishUrl || '',
				profileInfo.siteName || '',
				profileInfo.userName || '',
				password,
				tempDir
			);

			// Get the latest log file path
			const logFilePath = this.getLatestLogFilePath(tempDir);

			if (logFilePath) {
				// Read and display preview
				const preview = this.readLogPreview(logFilePath, lineCount);
				this.outputChannel.appendLine(preview);
				this.outputChannel.appendLine('');
				this.outputChannel.appendLine('='.repeat(80));
				this.outputChannel.appendLine(`📁 Full log file: ${logFilePath}`);
				this.outputChannel.appendLine(
					'💡 Tip: Click the file path above to open the complete log file'
				);
				this.outputChannel.appendLine('='.repeat(80));

				this.log(`✓ Quick log preview displayed`);
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
			this.outputChannel.appendLine('❌ ERROR: ' + error.message);
			vscode.window.showErrorMessage(`Failed to fetch logs: ${error.message}`);
		}
	}

	/**
	 * Download logs from IIS server using MSDeploy
	 */
	private async downloadLogsViaMSDeploy(
		publishUrl: string,
		siteName: string,
		userName: string,
		password: string,
		destDir: string
	): Promise<void> {
		this.log(`Downloading logs via MSDeploy from ${publishUrl}...`);

		// Find msdeploy.exe path
		const msdeployPath = this.findMsDeployPath();
		if (!msdeployPath) {
			throw new Error(
				'MSDeploy (msdeploy.exe) not found. Please install Web Deploy from https://www.iis.net/downloads/microsoft/web-deploy'
			);
		}

		// Get log path from profile
		const profileInfo = this.getCurrentProfileInfo();
		if (!profileInfo?.logPath) {
			throw new Error(
				'Log path not configured. Please set the log path in profile settings (e.g., D:\\www\\site\\logs\\stdout)'
			);
		}

		const logPath = profileInfo.logPath;
		this.log(`Using log path from profile: ${logPath}`);

		// Ensure publishUrl has port (add default 8172 if missing)
		let serverUrl = publishUrl;
		if (!serverUrl.includes(':')) {
			serverUrl = `${serverUrl}:8172`;
			this.log(`Added default port 8172: ${serverUrl}`);
		}

		// Build computerName URL
		const computerName = `https://${serverUrl}/msdeploy.axd?site=${siteName}`;
		this.log(`MSDeploy computerName: ${computerName}`);

		const command =
			`"${msdeployPath}" ` +
			`-verb:sync ` +
			`-source:dirPath="${logPath}",` +
			`computerName="${computerName}",` +
			`userName="${userName}",` +
			`password="${password}",` +
			`authType="Basic" ` +
			`-dest:dirPath="${destDir}" ` +
			`-allowUntrusted ` +
			`-verbose`;

		this.log(`Executing MSDeploy sync...`);

		try {
			const { stdout, stderr } = await execAsync(command, {
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				timeout: 60000, // 60 second timeout
			});

			if (stdout) {
				this.log(`MSDeploy output: ${stdout.substring(0, 500)}...`);
			}
			if (stderr && !stderr.includes('Info:')) {
				this.log(`MSDeploy stderr: ${stderr.substring(0, 500)}...`);
			}

			this.log('✓ Logs downloaded successfully');
		} catch (error: any) {
			this.log(`MSDeploy error: ${error.message}`);
			throw new Error(`Failed to download logs via MSDeploy: ${error.message}`);
		}
	}

	/**
	 * Get current profile info (to be set before calling viewLogs)
	 */
	private currentProfileInfo: PublishProfileInfo | null = null;

	private getCurrentProfileInfo(): PublishProfileInfo | null {
		return this.currentProfileInfo;
	}

	/**
	 * Find msdeploy.exe path from common installation locations
	 */
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

		// Try to find in PATH
		try {
			const { stdout } = require('child_process').execSync('where msdeploy.exe', {
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

	/**
	 * Get the path to the latest log file from downloaded directory
	 */
	private getLatestLogFilePath(logDir: string): string | null {
		try {
			if (!fs.existsSync(logDir)) {
				this.log('Log directory not found locally.');
				return null;
			}

			// Find all .log files
			const files = fs
				.readdirSync(logDir)
				.filter((f) => f.endsWith('.log'))
				.map((f) => ({
					name: f,
					path: path.join(logDir, f),
					mtime: fs.statSync(path.join(logDir, f)).mtime,
				}))
				.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

			if (files.length === 0) {
				this.log('No log files found.');
				return null;
			}

			const latestLog = files[0];
			this.log(`Found latest log: ${latestLog.name}`);
			return latestLog.path;
		} catch (error: any) {
			this.log(`Error finding log file: ${error.message}`);
			return null;
		}
	}

	/**
	 * Read log file preview (last N lines with metadata)
	 */
	private readLogPreview(logFilePath: string, lineCount: number): string {
		try {
			const stats = fs.statSync(logFilePath);
			const content = fs.readFileSync(logFilePath, 'utf-8');
			const lines = content.split('\n');
			const lastLines = lines.slice(-lineCount);

			const fileName = path.basename(logFilePath);
			const fileSize = (stats.size / 1024).toFixed(2);
			const lastModified = stats.mtime.toLocaleString();

			const output = [
				`📄 File: ${fileName}`,
				`📊 Size: ${fileSize} KB`,
				`🕒 Last Modified: ${lastModified}`,
				`📝 Showing last ${lastLines.length} of ${lines.length} lines`,
				'',
				'─'.repeat(80),
				'',
				...lastLines,
			].join('\n');

			return output;
		} catch (error: any) {
			this.log(`Error reading log preview: ${error.message}`);
			return `Error reading log file: ${error.message}`;
		}
	}

	private log(message: string): void {
		this.extensionOutputChannel.appendLine(`[LogViewerService] ${message}`);
	}

	/**
	 * Dispose resources
	 */
	dispose(): void {
		this.outputChannel.dispose();
	}
}
