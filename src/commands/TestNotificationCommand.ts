import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { NotificationService } from '../services/NotificationService';
import { DeploymentRecord } from '../models/DeploymentRecord';

export class TestNotificationCommand implements ICommand {
	readonly id = 'dotnet-project-toolkit.testNotification';

	constructor(private readonly outputChannel: vscode.OutputChannel) {}

	async execute(): Promise<void> {
		const config = vscode.workspace.getConfiguration('dotnetToolkit');
		const platform = config.get<string>('notificationPlatform', 'none');

		if (platform === 'none') {
			vscode.window.showWarningMessage(
				'Notification platform is not configured. Please set notificationPlatform in settings.'
			);
			return;
		}

		const webhookUrl =
			platform === 'slack'
				? config.get<string>('slackWebhookUrl', '')
				: config.get<string>('teamsWebhookUrl', '');

		if (!webhookUrl) {
			vscode.window.showWarningMessage(
				`No ${platform} webhook URL configured. Please set ${platform}WebhookUrl in settings.`
			);
			return;
		}

		const notificationService = new NotificationService(this.outputChannel);

		const testRecord: DeploymentRecord = {
			id: 'test-' + Date.now(),
			profileName: 'TEST-PROFILE',
			projectName: 'Test Project',
			environment: 'TEST',
			status: 'success',
			startTime: new Date().toISOString(),
			duration: 1000,
		};

		try {
			vscode.window.showInformationMessage(`Testing ${platform} notification...`);

			const result = await notificationService.sendDeploymentNotification(testRecord);

			if (result.success) {
				vscode.window.showInformationMessage(
					`✅ ${platform.charAt(0).toUpperCase() + platform.slice(1)} notification sent successfully!`
				);
			} else {
				vscode.window.showErrorMessage(
					`❌ Failed to send ${platform} notification: ${result.error}`
				);
			}
		} catch (error: any) {
			vscode.window.showErrorMessage(`Error: ${error.message}`);
		}
	}
}
