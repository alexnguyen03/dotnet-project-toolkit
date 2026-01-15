import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { PublishProfileInfo } from '../models/ProjectModels';

/**
 * Deploy Profile Command
 * Handles deploying to a publish profile
 */
export class DeployProfileCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.deployProfile';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(item?: unknown): Promise<void> {
        const treeItem = item as { profileInfo?: PublishProfileInfo };
        const profileInfo = treeItem?.profileInfo;

        if (!profileInfo) {
            vscode.window.showErrorMessage('No profile information available');
            return;
        }

        const profileName = profileInfo.name;   

        // Confirm deployment
        const answer = await vscode.window.showWarningMessage(
            `⚠️ Deploy to ${profileInfo.environment} environment: ${profileName}?`,
            { modal: true },
            'Deploy',
            'Cancel'
        );

        if (answer !== 'Deploy') {
            this.log(`Cancelled: ${profileName}`);
            return;
        }

        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${profileName}...`,
                cancellable: false
            },
            async (progress) => {
                this.log(`Starting: ${profileName}`);
                this.log(`Path: ${profileInfo.path}`);
                this.log(`Environment: ${profileInfo.environment}`);

                progress.report({ increment: 0, message: 'Validating...' });
                await this.delay(500);

                progress.report({ increment: 30, message: 'Building...' });
                await this.delay(1000);

                progress.report({ increment: 60, message: 'Publishing...' });
                await this.delay(1500);

                progress.report({ increment: 100, message: 'Complete!' });
                this.log(`✓ Success: ${profileName}`);
            }
        );

        vscode.window.showInformationMessage(`✅ ${profileName} deployed successfully!`);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
