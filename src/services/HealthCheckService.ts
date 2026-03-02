import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';

export interface HealthCheckResult {
	success: boolean;
	statusCode?: number;
	responseTime?: number;
	error?: string;
}

export interface IHealthCheckService {
	/**
	 * Check if a URL is responding
	 * @param url The URL to check
	 * @param timeoutMs Timeout in milliseconds
	 * @returns HealthCheckResult
	 */
	check(url: string, timeoutMs?: number): Promise<HealthCheckResult>;
}

export class HealthCheckService implements IHealthCheckService {
	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	async check(url: string, timeoutMs: number = 10000): Promise<HealthCheckResult> {
		const startTime = Date.now();

		return new Promise((resolve) => {
			if (!url) {
				resolve({
					success: false,
					error: 'URL is empty',
				});
				return;
			}

			try {
				const parsedUrl = new URL(url);
				const client = parsedUrl.protocol === 'https:' ? https : http;

				const req = client.get(url, { timeout: timeoutMs }, (res) => {
					const responseTime = Date.now() - startTime;
					const success =
						res.statusCode !== undefined &&
						res.statusCode >= 200 &&
						res.statusCode < 400;

					this.outputChannel.appendLine(
						`[HealthCheck] ${url} - Status: ${res.statusCode}, Time: ${responseTime}ms`
					);

					resolve({
						success,
						statusCode: res.statusCode,
						responseTime,
					});
				});

				req.on('error', (error) => {
					const responseTime = Date.now() - startTime;
					this.outputChannel.appendLine(`[HealthCheck] ${url} - Error: ${error.message}`);

					resolve({
						success: false,
						responseTime,
						error: error.message,
					});
				});

				req.on('timeout', () => {
					req.destroy();
					const responseTime = Date.now() - startTime;
					this.outputChannel.appendLine(
						`[HealthCheck] ${url} - Timeout after ${responseTime}ms`
					);

					resolve({
						success: false,
						responseTime,
						error: 'Request timed out',
					});
				});
			} catch (error: any) {
				const responseTime = Date.now() - startTime;
				this.outputChannel.appendLine(
					`[HealthCheck] ${url} - Invalid URL: ${error.message}`
				);

				resolve({
					success: false,
					responseTime,
					error: `Invalid URL: ${error.message}`,
				});
			}
		});
	}

	/**
	 * Check URL with retry logic
	 */
	async checkWithRetry(
		url: string,
		retryCount: number = 3,
		delayMs: number = 2000
	): Promise<HealthCheckResult> {
		for (let i = 0; i < retryCount; i++) {
			const result = await this.check(url);

			if (result.success) {
				return result;
			}

			if (i < retryCount - 1) {
				this.outputChannel.appendLine(
					`[HealthCheck] Retrying in ${delayMs}ms... (${i + 1}/${retryCount})`
				);
				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		return await this.check(url);
	}
}
