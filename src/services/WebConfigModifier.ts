import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Web.config Modifier Service
 * Modifies web.config on remote IIS server after deployment
 */
export interface IWebConfigModifier {
	/**
	 * Enable or disable stdout logging in web.config
	 */
	modifyStdoutLogging(
		publishUrl: string,
		siteName: string,
		userName: string,
		password: string,
		enable: boolean
	): Promise<void>;
}

/**
 * Web.config Modifier Implementation
 * Uses MSDeploy to pull web.config, modify it locally, and push it back.
 * This avoids PowerShell 'runCommand' privilege errors (HRESULT: 0x80070522).
 */
export class WebConfigModifier implements IWebConfigModifier {
	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	async modifyStdoutLogging(
		publishUrl: string,
		siteName: string,
		userName: string,
		password: string,
		enable: boolean
	): Promise<void> {
		const tempFile = path.join(os.tmpdir(), `web_${Date.now()}.config`);

		try {
			this.log(`Modifying web.config stdout logging: ${enable ? 'ENABLE' : 'DISABLE'}`);

			// 1. Find msdeploy.exe
			const msdeployPath = this.findMsDeployPath();
			if (!msdeployPath) {
				throw new Error('MSDeploy (msdeploy.exe) not found.');
			}

			// 2. Resolve destination publish URL properly format
			let destComputerName = publishUrl;
			if (!destComputerName.toLowerCase().startsWith('http')) {
				destComputerName = `https://${destComputerName}:8172/msdeploy.axd?site=${siteName}`;
			} else if (!destComputerName.includes('site=')) {
				const separator = destComputerName.includes('?') ? '&' : '?';
				destComputerName = `${destComputerName}${separator}site=${siteName}`;
			}

			const remoteContentPath = `${siteName}/web.config`;

			// 3. Download web.config from remote server
			this.log('Downloading remote web.config...');
			const pullCommand =
				`& "${msdeployPath}" -verb:sync ` +
				`'-source:contentPath="${remoteContentPath}",computerName="${destComputerName}",userName="${userName}",password="${password}",authType="Basic"' ` +
				`'-dest:contentPath="${tempFile}"' ` +
				`-allowUntrusted`;

			await execAsync(pullCommand, { shell: 'powershell.exe' });

			if (!fs.existsSync(tempFile)) {
				throw new Error('Downloaded web.config file not found in temp directory.');
			}

			// 4. Modify the file locally
			this.log('Modifying web.config locally...');
			let webConfigContent = fs.readFileSync(tempFile, 'utf8');

			const stdoutEnabled = enable ? 'true' : 'false';
			const stdoutLogFile = '.\\logs\\stdout';

			// Find <aspNetCore ... > and replace attributes
			if (webConfigContent.includes('<aspNetCore')) {
				// We use regex to safely replace stdoutLogEnabled and stdoutLogFile attributes
				// If they don't exist, we add them before the closing bracket of the aspNetCore tag
				if (/stdoutLogEnabled="[^"]*"/.test(webConfigContent)) {
					webConfigContent = webConfigContent.replace(
						/stdoutLogEnabled="[^"]*"/g,
						`stdoutLogEnabled="${stdoutEnabled}"`
					);
				} else {
					webConfigContent = webConfigContent.replace(
						/<aspNetCore /,
						`<aspNetCore stdoutLogEnabled="${stdoutEnabled}" `
					);
				}

				if (/stdoutLogFile="[^"]*"/.test(webConfigContent)) {
					webConfigContent = webConfigContent.replace(
						/stdoutLogFile="[^"]*"/g,
						`stdoutLogFile="${stdoutLogFile}"`
					);
				} else {
					webConfigContent = webConfigContent.replace(
						/<aspNetCore /,
						`<aspNetCore stdoutLogFile="${stdoutLogFile}" `
					);
				}
			}

			fs.writeFileSync(tempFile, webConfigContent, 'utf8');

			// 5. Upload web.config back to remote server
			this.log('Uploading modified web.config to server...');
			const pushCommand =
				`& "${msdeployPath}" -verb:sync ` +
				`'-source:contentPath="${tempFile}"' ` +
				`'-dest:contentPath="${remoteContentPath}",computerName="${destComputerName}",userName="${userName}",password="${password}",authType="Basic"' ` +
				`-allowUntrusted`;

			await execAsync(pushCommand, { shell: 'powershell.exe' });

			this.log('✓ Web.config modified successfully');
		} catch (error: any) {
			const firstLine = (error.message as string).split('\n')[0].trim();
			this.log(`Error modifying web.config: ${firstLine}`);
			vscode.window.showWarningMessage(
				`Deployment succeeded, but failed to modify web.config stdout logging. Check output for details.`
			);
		} finally {
			// Cleanup
			if (fs.existsSync(tempFile)) {
				try {
					fs.unlinkSync(tempFile);
				} catch (e) {}
			}
		}
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

	private log(message: string): void {
		const redactedMessage = message
			.replace(/userName\s*[=:]\s*"[^"]*"/gi, 'userName="***"')
			.replace(/password\s*[=:]\s*"[^"]*"/gi, 'password="***"')
			.replace(/userName\s*[=:]\s*'[^']*'/gi, "userName='***'")
			.replace(/password\s*[=:]\s*'[^']*'/gi, "password='***'")
			.replace(/userName\s*[=:]\s*([^'",\s}]+)/gi, 'userName=***')
			.replace(/password\s*[=:]\s*([^'",\s}]+)/gi, 'password=***');

		this.outputChannel.appendLine(`[WebConfigModifier] ${redactedMessage}`);
	}
}
