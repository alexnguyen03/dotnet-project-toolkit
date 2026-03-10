import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { IWebConfigModifier } from './WebConfigModifier';
import { HealthCheckService } from './HealthCheckService';

/**
 * Deployment result
 */
export interface DeploymentResult {
	success: boolean;
	errorMessage?: string;
	output: string;
	healthCheckResult?: {
		success: boolean;
		statusCode?: number;
		responseTime?: number;
		error?: string;
	};
}

/**
 * Deployment Service Interface
 * Handles actual deployment execution via dotnet publish
 */
export interface IDeploymentService {
	deploy(
		projectPath: string,
		projectName: string,
		profileInfo: PublishProfileInfo,
		onProgress?: (message: string, increment: number) => void
	): Promise<DeploymentResult>;
}

/**
 * Deployment Service Implementation
 * Executes dotnet publish with MSDeploy parameters
 */
export class DeploymentService implements IDeploymentService {
	private healthCheckService: HealthCheckService;

	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly passwordStorage: IPasswordStorage,
		private readonly webConfigModifier?: IWebConfigModifier
	) {
		this.healthCheckService = new HealthCheckService(outputChannel);
	}

	async deploy(
		projectPath: string,
		projectName: string,
		profileInfo: PublishProfileInfo,
		onProgress?: (message: string, increment: number) => void
	): Promise<DeploymentResult> {
		try {
			// 1. Get password from storage
			onProgress?.('Retrieving credentials...', 10);
			const password = await this.getPassword(projectName, profileInfo.fileName);
			if (!password) {
				return {
					success: false,
					errorMessage: 'Password not found. Please configure credentials first.',
					output: '',
				};
			}

			// 2. Build dotnet publish command
			onProgress?.(`Building ${projectName} (${profileInfo.fileName})...`, 30);
			const command = this.buildPublishCommand(projectPath, profileInfo, password);
			this.log(`Executing: dotnet publish with secure password handling`);

			// 3. Execute deployment
			onProgress?.(
				`Publishing ${projectName} to ${profileInfo.environment.toUpperCase()} (${profileInfo.siteName})...`,
				60
			);
			const result = await this.executeCommand(command, path.dirname(projectPath));

			// 4. Check result
			if (result.exitCode === 0) {
				onProgress?.('Deployment complete!', 90);

				// 5. Modify web.config if stdout logging is enabled
				if (profileInfo.enableStdoutLog && this.webConfigModifier) {
					try {
						onProgress?.('Configuring stdout logging...', 95);
						await this.webConfigModifier.modifyStdoutLogging(
							profileInfo.publishUrl || '',
							profileInfo.siteName || '',
							profileInfo.userName || '',
							password,
							true
						);
					} catch (error: any) {
						this.log(`Warning: Could not modify web.config: ${error.message}`);
					}
				}

				// 6. Health check if siteUrl is available
				let healthCheckResult: DeploymentResult['healthCheckResult'];
				if (profileInfo.siteUrl) {
					onProgress?.('Running health check...', 95);
					this.outputChannel.appendLine(
						`[HealthCheck] Checking ${profileInfo.siteUrl}...`
					);

					const config = vscode.workspace.getConfiguration('dotnetToolkit');
					const enableHealthCheck = config.get<boolean>('enableHealthCheck', true);
					const healthCheckTimeout = config.get<number>('healthCheckTimeout', 10000);
					const retryCount = config.get<number>('healthCheckRetryCount', 3);

					if (enableHealthCheck) {
						healthCheckResult = await this.healthCheckService.checkWithRetry(
							profileInfo.siteUrl,
							retryCount,
							2000
						);

						if (healthCheckResult.success) {
							this.outputChannel.appendLine(
								`[HealthCheck] ✓ Site is healthy (${healthCheckResult.statusCode}, ${healthCheckResult.responseTime}ms)`
							);
						} else {
							this.outputChannel.appendLine(
								`[HealthCheck] ⚠️ Site may not be ready: ${healthCheckResult.error}`
							);
						}
					} else {
						this.outputChannel.appendLine(
							`[HealthCheck] Skipped (disabled in settings)`
						);
						healthCheckResult = { success: false, error: 'Disabled' };
					}
				}

				onProgress?.(
					`✅ ${projectName} (${profileInfo.fileName}) deployed successfully!`,
					100
				);
				return {
					success: true,
					output: result.output,
					healthCheckResult,
				};
			} else {
				return {
					success: false,
					errorMessage: this.extractErrorMessage(result.output),
					output: result.output,
				};
			}
		} catch (error: any) {
			this.log(`Deployment error: ${error.message}`);
			return {
				success: false,
				errorMessage: error.message || 'Unknown deployment error',
				output: error.toString(),
			};
		}
	}

	/**
	 * Get password from storage
	 */
	private async getPassword(
		projectName: string,
		profileName: string
	): Promise<string | undefined> {
		const key = this.passwordStorage.generateKey(projectName, profileName);
		return await this.passwordStorage.retrieve(key);
	}

	/**
	 * Build dotnet publish command with MSDeploy parameters
	 * Password is passed via environment variable for security
	 */
	private buildPublishCommand(
		projectPath: string,
		profileInfo: PublishProfileInfo,
		password: string
	): string {
		const profileName = profileInfo.fileName;
		const passwordEnvVar = 'DOTNET_PUBLISH_PASSWORD';

		const args = [
			'$env:DOTNET_PUBLISH_PASSWORD="' + password + '"; ',
			'$env:DOTNET_SYSTEM_NET_HTTP_USESOCKETSHANDLER=0; ',
			'[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }; ',
			'dotnet',
			'publish',
			`"${projectPath}"`,
			`/p:PublishProfile="${profileName}"`,
			'/p:Password=$env:DOTNET_PUBLISH_PASSWORD',
			'/p:Configuration=Release',
			'/p:AllowUntrustedCertificate=true',
		];

		return args.join(' ');
	}

	/**
	 * Execute command and capture output with timeout
	 */
	private async executeCommand(
		command: string,
		cwd: string,
		timeoutMs: number = 300000
	): Promise<{ exitCode: number; output: string }> {
		return new Promise((resolve) => {
			let output = '';
			let timedOut = false;

			const process = cp.exec(command, {
				cwd,
				maxBuffer: 10 * 1024 * 1024,
				shell: 'powershell.exe',
			});

			const timeoutId = setTimeout(() => {
				timedOut = true;
				process.kill('SIGTERM');
				output += '\nCommand timed out after ' + timeoutMs / 1000 + ' seconds';
				this.outputChannel.appendLine(
					`[Timeout] Command timed out after ${timeoutMs / 1000}s`
				);
			}, timeoutMs);

			process.stdout?.on('data', (data: Buffer) => {
				const text = data.toString();
				output += text;
				this.outputChannel.append(this.redactCredentials(text));
			});

			process.stderr?.on('data', (data: Buffer) => {
				const text = data.toString();
				output += text;
				this.outputChannel.append(this.redactCredentials(text));
			});

			process.on('close', (code: number) => {
				clearTimeout(timeoutId);
				if (timedOut) {
					resolve({
						exitCode: 124,
						output,
					});
				} else {
					resolve({
						exitCode: code || 0,
						output,
					});
				}
			});

			process.on('error', (error: Error) => {
				clearTimeout(timeoutId);
				output += `\nProcess error: ${error.message}`;
				this.outputChannel.appendLine(this.redactCredentials(`Process error: ${error.message}`));
				resolve({
					exitCode: 1,
					output,
				});
			});
		});
	}

	/**
	 * Extract meaningful error message from output
	 */
	private extractErrorMessage(output: string): string {
		// Look for common error patterns
		const errorPatterns = [
			/error\s*:\s*(.+)/i,
			/failed\s*:\s*(.+)/i,
			/exception\s*:\s*(.+)/i,
			/Build FAILED/i,
		];

		for (const pattern of errorPatterns) {
			const match = output.match(pattern);
			if (match) {
				return match[1] || match[0];
			}
		}

		// If no specific error found, return last few lines
		const lines = output.split('\n').filter((l) => l.trim());
		return lines.slice(-5).join('\n') || 'Deployment failed. Check output for details.';
	}

	/**
	 * Redact userName and password from MSDeploy / MSBuild log output
	 * before writing to the output channel.
	 */
	private redactCredentials(text: string): string {
		return text
			.replace(/userName\s*[=:]\s*"[^"]*"/gi, 'userName="***"')
			.replace(/password\s*[=:]\s*"[^"]*"/gi, 'password="***"')
			.replace(/userName\s*[=:]\s*'[^']*'/gi, "userName='***'")
			.replace(/password\s*[=:]\s*'[^']*'/gi, "password='***'")
			.replace(/userName\s*[=:]\s*([^'",\s}]+)/gi, 'userName=***')
			.replace(/password\s*[=:]\s*([^'",\s}]+)/gi, 'password=***');
	}

	private log(message: string): void {
		this.outputChannel.appendLine(`[DeploymentService] ${this.redactCredentials(message)}`);
	}
}
