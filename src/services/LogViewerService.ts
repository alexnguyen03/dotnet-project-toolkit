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
 * Handles fetching and displaying remote IIS logs
 */
export interface ILogViewerService {
	/**
	 * Fetch and display logs from remote IIS server
	 * @param profileInfo Profile information containing server details
	 * @param password Deployment password for authentication
	 * @param lineCount Number of lines to fetch (default: 100)
	 */
	viewLogs(profileInfo: PublishProfileInfo, password: string, lineCount?: number): Promise<void>;
}

/**
 * Log Viewer Service Implementation
 * Uses MSDeploy to download logs from remote IIS server
 */
export class LogViewerService implements ILogViewerService {
	private outputChannel: vscode.OutputChannel;

	constructor(private readonly extensionOutputChannel: vscode.OutputChannel) {
		// Create dedicated output channel for logs
		this.outputChannel = vscode.window.createOutputChannel('IIS Stdout Logs');
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
			this.outputChannel.show();
			this.outputChannel.appendLine('='.repeat(80));
			this.outputChannel.appendLine(`Fetching logs from: ${profileInfo.siteName}`);
			this.outputChannel.appendLine(`Server: ${profileInfo.publishUrl}`);
			this.outputChannel.appendLine(`Lines: ${lineCount}`);
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

			// Read and display the latest log file
			const logContent = this.readLatestLogFile(tempDir, lineCount);

			// Display logs
			if (logContent && logContent.trim()) {
				this.outputChannel.appendLine(logContent);
				this.outputChannel.appendLine('');
				this.outputChannel.appendLine('='.repeat(80));
				this.outputChannel.appendLine('✓ Logs fetched successfully');
				this.outputChannel.appendLine(`📁 Downloaded to: ${tempDir}`);
				this.outputChannel.appendLine('='.repeat(80));

				vscode.window.showInformationMessage(
					'Logs fetched successfully. Check "IIS Stdout Logs" output.'
				);
			} else {
				this.outputChannel.appendLine('No logs found or log file is empty.');
				vscode.window.showWarningMessage('No logs found on the server.');
			}
		} catch (error: any) {
			this.log(`Error fetching logs: ${error.message}`);
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
	 * Read the latest log file from downloaded directory
	 */
	private readLatestLogFile(logDir: string, lineCount: number): string {
		try {
			if (!fs.existsSync(logDir)) {
				return 'Log directory not found locally.';
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
				return 'No log files found.';
			}

			const latestLog = files[0];
			this.log(`Reading latest log: ${latestLog.name}`);

			// Read file content
			const content = fs.readFileSync(latestLog.path, 'utf-8');
			const lines = content.split('\n');

			// Get last N lines
			const lastLines = lines.slice(-lineCount);

			// Build output with metadata
			const output = [
				`=== Latest Log File: ${latestLog.name} ===`,
				`=== Last Modified: ${latestLog.mtime.toLocaleString()} ===`,
				`=== Size: ${(fs.statSync(latestLog.path).size / 1024).toFixed(2)} KB ===`,
				`=== Showing last ${lastLines.length} lines ===`,
				'',
				...lastLines,
			].join('\n');

			return output;
		} catch (error: any) {
			this.log(`Error reading log file: ${error.message}`);
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
