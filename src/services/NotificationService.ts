import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { DeploymentRecord, DeploymentRecordHelper } from '../models/DeploymentRecord';

export type NotificationPlatform = 'slack' | 'none';

export interface NotificationResult {
	success: boolean;
	error?: string;
}

export interface INotificationService {
	/**
	 * Send notification after deployment
	 */
	sendDeploymentNotification(record: DeploymentRecord): Promise<NotificationResult>;
}

export class NotificationService implements INotificationService {
	constructor(private readonly outputChannel: vscode.OutputChannel) { }

	async sendDeploymentNotification(record: DeploymentRecord): Promise<NotificationResult> {
		const config = vscode.workspace.getConfiguration('dotnetToolkit');
		const platform = config.get<NotificationPlatform>('notificationPlatform', 'none');

		if (platform === 'none') {
			this.outputChannel.appendLine('[Notification] Notifications disabled');
			return { success: true };
		}

		const webhookUrl = config.get<string>('slackWebhookUrl', '');

		if (!webhookUrl) {
			this.outputChannel.appendLine(
				`[Notification] No webhook URL configured for ${platform}`
			);
			return { success: false, error: 'No webhook URL configured' };
		}

		try {
			if (platform === 'slack') {
				return await this.sendSlackNotification(record, webhookUrl);
			}

			return { success: false, error: 'Unknown platform' };
		} catch (error: any) {
			this.outputChannel.appendLine(`[Notification] Failed: ${error.message}`);
			return { success: false, error: error.message };
		}
	}

	private async sendSlackNotification(
		record: DeploymentRecord,
		webhookUrl: string
	): Promise<NotificationResult> {
		const statusEmoji = record.status === 'success' ? ':white_check_mark:' : ':x:';
		const statusColor = record.status === 'success' ? '#36a64f' : '#ff0000';

		const payload = {
			attachments: [
				{
					color: statusColor,
					blocks: [
						{
							type: 'header',
							text: {
								type: 'plain_text',
								text: `${statusEmoji} Deployment ${record.status === 'success' ? 'Succeeded' : 'Failed'}`,
							},
						},
						{
							type: 'section',
							fields: [
								{
									type: 'mrkdwn',
									text: `*Project:*\n${record.projectName}`,
								},
								{
									type: 'mrkdwn',
									text: `*Environment:*\n${record.environment}`,
								},
								{
									type: 'mrkdwn',
									text: `*Profile:*\n${record.profileName}`,
								},
								{
									type: 'mrkdwn',
									text: `*Duration:*\n${record.duration ? DeploymentRecordHelper.formatDuration(record.duration) : 'N/A'}`,
								},
							],
						},
						{
							type: 'context',
							elements: [
								{
									type: 'mrkdwn',
									text: `Deployed at ${DeploymentRecordHelper.formatTimestamp(record.startTime)}`,
								},
							],
						},
					],
				},
			],
		};

		return this.sendWebhook(webhookUrl, JSON.stringify(payload));
	}

	private sendWebhook(webhookUrl: string, payload: string): Promise<NotificationResult> {
		return new Promise((resolve) => {
			try {
				const parsedUrl = new URL(webhookUrl);
				const isHttps = parsedUrl.protocol === 'https:';
				const client = isHttps ? https : http;

				const options = {
					hostname: parsedUrl.hostname,
					port: parsedUrl.port || (isHttps ? 443 : 80),
					path: parsedUrl.pathname,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Content-Length': Buffer.byteLength(payload),
					},
				};

				const req = client.request(options, (res) => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						this.outputChannel.appendLine('[Notification] Sent successfully');
						resolve({ success: true });
					} else {
						this.outputChannel.appendLine(
							`[Notification] Failed with status: ${res.statusCode}`
						);
						resolve({ success: false, error: `HTTP ${res.statusCode}` });
					}
				});

				req.on('error', (error) => {
					this.outputChannel.appendLine(`[Notification] Error: ${error.message}`);
					resolve({ success: false, error: error.message });
				});

				req.write(payload);
				req.end();
			} catch (error: any) {
				resolve({ success: false, error: error.message });
			}
		});
	}
}
