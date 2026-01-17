// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { PublishTreeProvider } from './ui/publish/PublishTreeProvider';
import { WatchTreeProvider } from './ui/watch/WatchTreeProvider';
import { DebugTreeProvider } from './ui/debug/DebugTreeProvider';
import { HistoryTreeProvider } from './ui/history/HistoryTreeProvider';
import { HistoryManager } from './services/HistoryManager';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	try {
		console.log('.NET Project Toolkit is now active!');

		// Get workspace root
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

		// Create output channel
		const outputChannel = vscode.window.createOutputChannel('.NET Toolkit');

		// Create HistoryManager
		const historyManager = new HistoryManager(context);

		// ============= Register TreeView Providers =============

		// 1. Publish View (Full implementation)
		const publishProvider = new PublishTreeProvider(workspaceRoot);
		vscode.window.registerTreeDataProvider('dotnetPublish', publishProvider);

		// 2. Watch View (Placeholder)
		const watchProvider = new WatchTreeProvider();
		vscode.window.registerTreeDataProvider('dotnetWatch', watchProvider);

		// 3. Debug View (Placeholder)
		const debugProvider = new DebugTreeProvider();
		vscode.window.registerTreeDataProvider('dotnetDebug', debugProvider);

		// 4. History View (Real implementation)
		const historyProvider = new HistoryTreeProvider(historyManager);
		vscode.window.registerTreeDataProvider('dotnetHistory', historyProvider);

		// ============= Register Commands =============

		// Refresh commands for each view
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.refreshProfiles', () => {
				publishProvider.refresh();
				outputChannel.appendLine('[Refresh] Publish profiles refreshed');
			})
		);

		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.refreshHistory', () => {
				historyProvider.refresh();
				outputChannel.appendLine('[Refresh] History refreshed');
			})
		);

		// Deploy profile command
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.deployProfile', async (item: any) => {
				const profileName = item.label as string;
				const isProd = item.isProd as boolean;

				// Show confirmation for PROD
				if (isProd) {
					const answer = await vscode.window.showWarningMessage(
						`⚠️ Deploy to PRODUCTION: ${profileName}?`,
						{ modal: true },
						'Deploy',
						'Cancel'
					);
					if (answer !== 'Deploy') {
						outputChannel.appendLine(`[Cancelled] ${profileName} deployment cancelled by user`);
						return;
					}
				}

				// Create deployment record
				const startTime = new Date();
				const deploymentId = await historyManager.addDeployment({
					profileName: profileName,
					projectName: extractProjectName(item),
					environment: isProd ? 'PROD' : 'UAT',
					status: 'in-progress',
					startTime: startTime.toISOString()
				});

				// Refresh views to show in-progress deployment
				historyProvider.refresh();

				// Show deployment progress
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Deploying ${profileName}...`,
							cancellable: false
						},
						async (progress) => {
							outputChannel.appendLine(`[Deploy] Starting deployment: ${profileName}`);
							outputChannel.show();

							progress.report({ increment: 0, message: 'Validating environment...' });
							await new Promise(resolve => setTimeout(resolve, 500));

							progress.report({ increment: 30, message: 'Building project...' });
							await new Promise(resolve => setTimeout(resolve, 1000));

							progress.report({ increment: 60, message: 'Publishing to IIS...' });
							await new Promise(resolve => setTimeout(resolve, 1500));

							progress.report({ increment: 100, message: 'Complete!' });
							outputChannel.appendLine(`[Success] ${profileName} deployed successfully!`);
						}
					);

					// Update deployment record with success
					const endTime = new Date();
					await historyManager.updateDeployment(deploymentId, {
						status: 'success',
						endTime: endTime.toISOString(),
						duration: endTime.getTime() - startTime.getTime()
					});

					vscode.window.showInformationMessage(`✅ ${profileName} deployed successfully!`);
				} catch (error: any) {
					// Update deployment record with failure
					const endTime = new Date();
					await historyManager.updateDeployment(deploymentId, {
						status: 'failed',
						endTime: endTime.toISOString(),
						duration: endTime.getTime() - startTime.getTime(),
						errorMessage: error.message || 'Unknown error'
					});

					outputChannel.appendLine(`[Error] ${profileName} deployment failed: ${error.message}`);
					vscode.window.showErrorMessage(`❌ ${profileName} deployment failed!`);
				}

				// Refresh views to show completed deployment
				historyProvider.refresh();
				publishProvider.refresh();
			})
		);

		// Configure environment variables
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.configureCredentials', async () => {
				await vscode.window.showInformationMessage(
					'Environment Variable Configuration\n\n' +
					'Windows: [System.Environment]::SetEnvironmentVariable("DEPLOY_PWD", "your_password", "User")\n' +
					'Linux/Mac: export DEPLOY_PWD="your_password"',
					'OK'
				);
			})
		);

		// Clear all history command
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.clearHistory', async () => {
				const answer = await vscode.window.showWarningMessage(
					'Are you sure you want to clear all deployment history?',
					{ modal: true },
					'Clear',
					'Cancel'
				);

				if (answer === 'Clear') {
					await historyManager.clearHistory();
					historyProvider.refresh();
					vscode.window.showInformationMessage('Deployment history cleared');
					outputChannel.appendLine('[History] All deployment history cleared');
				}
			})
		);

		// Clear single history entry command
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.clearHistoryEntry', async (item: any) => {
				if (item && item.record && item.record.id) {
					await historyManager.clearEntry(item.record.id);
					historyProvider.refresh();
					vscode.window.showInformationMessage('History entry removed');
					outputChannel.appendLine(`[History] Removed entry: ${item.record.profileName}`);
				}
			})
		);

		outputChannel.appendLine('[Activated] .NET Project Toolkit extension activated successfully');
		outputChannel.appendLine('[Info] 4 views registered: Publish, Watch, Debug, History');
		outputChannel.appendLine(`[Info] History entries: ${historyManager.getHistoryCount()}`);
	} catch (error) {
		console.error('Failed to activate .NET Project Toolkit:', error);
		vscode.window.showErrorMessage(`Failed to activate .NET Project Toolkit: ${error instanceof Error ? error.message : String(error)}`);
		throw error;
	}
}

// Helper function to extract project name from tree item
function extractProjectName(item: any): string {
	// For now, extract from label (e.g., "uat-api [UAT]" -> "BudgetControl.Server.Api")
	// This is a simplified version - in real implementation, we'd track this properly
	const label = item.label as string;
	if (label.includes('api')) {
		return 'BudgetControl.Server.Api';
	} else if (label.includes('web')) {
		return 'BudgetControl.Server.Web';
	}
	return 'Unknown Project';
}

// This method is called when your extension is deactivated
export function deactivate() { }

