import * as path from 'path';
import * as vscode from 'vscode';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { runProcess } from '../utils/ProcessRunner';
import { HealthCheckService } from './HealthCheckService';
import { IWebConfigModifier } from './WebConfigModifier';

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
			onProgress?.('Retrieving credentials...', 10);
			const password = await this.getPassword(projectName, profileInfo.fileName);
			if (!password) {
				this.log(
					`No stored password found for ${projectName}/${profileInfo.fileName}. Trying profile-native credentials (.pubxml.user) first.`
				);
			}

			onProgress?.(`Building ${projectName} (${profileInfo.fileName})...`, 30);
			const publishConfig = this.buildPublishConfig(projectPath, profileInfo, password);
			this.log('Executing: dotnet publish with secure password handling');

			onProgress?.(
				`Publishing ${projectName} to ${profileInfo.environment.toUpperCase()} (${profileInfo.siteName})...`,
				60
			);
			const result = await this.executeCommand(
				publishConfig.args,
				path.dirname(projectPath),
				publishConfig.env
			);
			let finalResult = result;

			// Fallback for environments where MSBuild does not resolve env vars as expected.
			// We only use this when a password exists and secure mode failed.
			if (result.exitCode !== 0 && password) {
				this.log(
					'Secure password injection failed. Retrying publish with inline password property for compatibility.'
				);
				const fallbackConfig = this.buildPublishConfigWithInlinePassword(
					projectPath,
					profileInfo,
					password
				);
				finalResult = await this.executeCommand(
					fallbackConfig.args,
					path.dirname(projectPath),
					fallbackConfig.env
				);
			}

			if (finalResult.exitCode === 0) {
				onProgress?.('Deployment complete!', 90);

				if (profileInfo.enableStdoutLog && this.webConfigModifier && password) {
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
				} else if (profileInfo.enableStdoutLog && !password) {
					this.log(
						'Skipping web.config stdout update because no stored password is available for msdeploy authentication.'
					);
				}

				let healthCheckResult: DeploymentResult['healthCheckResult'];
				if (profileInfo.siteUrl) {
					onProgress?.('Running health check...', 95);
					this.outputChannel.appendLine(`[HealthCheck] Checking ${profileInfo.siteUrl}...`);

					const config = vscode.workspace.getConfiguration('dotnetToolkit');
					const enableHealthCheck = config.get<boolean>('enableHealthCheck', true);
					const healthCheckTimeout = config.get<number>('healthCheckTimeout', 10000);
					const retryCount = config.get<number>('healthCheckRetryCount', 3);

					if (enableHealthCheck) {
						healthCheckResult = await this.healthCheckService.checkWithRetry(
							profileInfo.siteUrl,
							retryCount,
							2000,
							healthCheckTimeout
						);

						if (healthCheckResult.success) {
							this.outputChannel.appendLine(
								`[HealthCheck] Site is healthy (${healthCheckResult.statusCode}, ${healthCheckResult.responseTime}ms)`
							);
						} else {
							this.outputChannel.appendLine(
								`[HealthCheck] Site may not be ready: ${healthCheckResult.error}`
							);
						}
					} else {
						this.outputChannel.appendLine('[HealthCheck] Skipped (disabled in settings)');
						healthCheckResult = { success: false, error: 'Disabled' };
					}
				}

				onProgress?.(`${projectName} (${profileInfo.fileName}) deployed successfully!`, 100);
				return {
					success: true,
					output: finalResult.output,
					healthCheckResult,
				};
			}

			const errorMessage = this.extractErrorMessage(finalResult.output);
			const passwordHint = password
				? ''
				: '\nNo stored password was found. If publish profile credentials are not available in .pubxml.user, save password in extension Profile Info.';

			return {
				success: false,
				errorMessage: `${errorMessage}${passwordHint}`,
				output: finalResult.output,
			};
		} catch (error: any) {
			this.log(`Deployment error: ${error.message}`);
			return {
				success: false,
				errorMessage: error.message || 'Unknown deployment error',
				output: error.toString(),
			};
		}
	}

	private async getPassword(projectName: string, profileName: string): Promise<string | undefined> {
		const key = this.passwordStorage.generateKey(projectName, profileName);
		return await this.passwordStorage.retrieve(key);
	}

	private buildPublishConfig(
		projectPath: string,
		profileInfo: PublishProfileInfo,
		password?: string
	): { args: string[]; env: NodeJS.ProcessEnv } {
		const passwordEnvVar = 'DOTNET_PUBLISH_PASSWORD';
		const args = [
			'publish',
			projectPath,
			`/p:PublishProfile=${profileInfo.fileName}`,
			'/p:Configuration=Release',
			'/p:AllowUntrustedCertificate=true',
		];
		if (password) {
			args.push('/p:Password=$(DOTNET_PUBLISH_PASSWORD)');
		}

		return {
			args,
			env: {
				...process.env,
				...(password ? { [passwordEnvVar]: password } : {}),
				DOTNET_SYSTEM_NET_HTTP_USESOCKETSHANDLER: '0',
			},
		};
	}

	private buildPublishConfigWithInlinePassword(
		projectPath: string,
		profileInfo: PublishProfileInfo,
		password: string
	): { args: string[]; env: NodeJS.ProcessEnv } {
		return {
			args: [
				'publish',
				projectPath,
				`/p:PublishProfile=${profileInfo.fileName}`,
				`/p:Password=${password}`,
				'/p:Configuration=Release',
				'/p:AllowUntrustedCertificate=true',
			],
			env: {
				...process.env,
				DOTNET_SYSTEM_NET_HTTP_USESOCKETSHANDLER: '0',
			},
		};
	}

	private async executeCommand(
		args: string[],
		cwd: string,
		env: NodeJS.ProcessEnv,
		timeoutMs: number = 300000
	): Promise<{ exitCode: number; output: string }> {
		const result = await runProcess('dotnet', args, {
			cwd,
			env,
			timeoutMs,
			maxOutputBytes: 10 * 1024 * 1024,
			onStdout: (text) => {
				this.outputChannel.append(this.redactCredentials(text));
			},
			onStderr: (text) => {
				this.outputChannel.append(this.redactCredentials(text));
			},
		});

		if (result.timedOut) {
			this.outputChannel.appendLine(`[Timeout] Command timed out after ${timeoutMs / 1000}s`);
		}

		if (result.error) {
			this.outputChannel.appendLine(this.redactCredentials(`Process error: ${result.error}`));
		}

		return {
			exitCode: result.exitCode,
			output: result.output,
		};
	}

	private extractErrorMessage(output: string): string {
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

		const lines = output.split('\n').filter((l) => l.trim());
		return lines.slice(-5).join('\n') || 'Deployment failed. Check output for details.';
	}

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
