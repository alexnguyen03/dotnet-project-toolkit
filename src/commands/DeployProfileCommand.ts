import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { PublishTreeItem } from '../ui/publish/PublishTreeProvider';
import { HistoryManager } from '../services/HistoryManager';
import { PublishProfileInfo } from '../models/ProjectModels';

/**
 * Deploy Profile Command
 * Handles deploying to a publish profile
 */
export class DeployProfileCommand implements ICommand {
    readonly id = 'dotnet-project-toolkit.deployProfile';

    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly onRefresh: () => void,
        private readonly historyManager: HistoryManager
    ) { }

    async execute(item: PublishTreeItem): Promise<void> {
        if (!item || !item.profileInfo) {
            vscode.window.showErrorMessage('No publish profile selected');
            return;
        }

        const profile = item.profileInfo;
        const projectName = item.projectName || 'Unknown Project';
        const environment = profile.environment.toUpperCase();

        // 1. Confirm deployment (for ALL environments)
        const isProd = profile.environment === 'production';
        const confirmMessage = isProd
            ? `⚠️ Deploy to PRODUCTION: ${profile.name}?`
            : `Deploy to ${environment}: ${profile.name}?`;

        const confirm = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            'Deploy',
            'Cancel'
        );

        if (confirm !== 'Deploy') {
            return;
        }

        // 2. Add history record (in-progress)
        const startTime = new Date();
        const historyId = await this.historyManager.addDeployment({
            profileName: profile.fileName, // Use fileName for consistent ID
            projectName: projectName,
            environment: environment,
            status: 'in-progress',
            startTime: startTime.toISOString()
        }, profile.path);

        // Refresh views to show in-progress
        this.onRefresh();

        // 3. Start mock deployment process
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${profile.name}...`,
                cancellable: false
            }, async (progress) => {
                this.outputChannel.appendLine(`[Deploy] Starting deployment for ${profile.name} (${environment})`);
                this.outputChannel.show();

                progress.report({ message: 'Validating environment...', increment: 0 });
                await new Promise(resolve => setTimeout(resolve, 1000));

                progress.report({ message: 'Building project...', increment: 30 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                progress.report({ message: 'Publishing to IIS...', increment: 60 });
                await new Promise(resolve => setTimeout(resolve, 2000));

                progress.report({ message: 'Deployment complete!', increment: 100 });
            });

            // 4. Update history with success
            const endTime = new Date();
            await this.historyManager.updateDeployment(historyId, {
                status: 'success',
                endTime: endTime.toISOString(),
                duration: endTime.getTime() - startTime.getTime()
            }, profile.path);

            vscode.window.showInformationMessage(`✅ ${profile.name} deployed successfully!`);
            this.outputChannel.appendLine(`[Success] Deployment for ${profile.name} finished.`);

        } catch (error: any) {
            // 5. Update history with failure
            const endTime = new Date();
            await this.historyManager.updateDeployment(historyId, {
                status: 'failed',
                endTime: endTime.toISOString(),
                duration: endTime.getTime() - startTime.getTime(),
                errorMessage: error.message || 'Unknown error occurred during deployment'
            }, profile.path);

            vscode.window.showErrorMessage(`❌ Deployment failed: ${error.message}`);
            this.outputChannel.appendLine(`[Error] Deployment failed: ${error.message}`);
        } finally {
            this.onRefresh();
        }
    }
}
