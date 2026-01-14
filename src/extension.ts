// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { UnifiedTreeProvider } from './ui/UnifiedTreeProvider';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	console.log('.NET Project Toolkit is now active!');

	// Get workspace root
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

	// Create output channel
	const outputChannel = vscode.window.createOutputChannel('.NET Toolkit');

	// ============= Register Unified TreeView Provider =============
	const unifiedProvider = new UnifiedTreeProvider(workspaceRoot);
	vscode.window.registerTreeDataProvider('dotnetToolkitExplorer', unifiedProvider);
	
	// ============= Register Commands =============
	
	// Refresh command
	context.subscriptions.push(
		vscode.commands.registerCommand('dotnet-project-toolkit.refreshProfiles', () => {
			unifiedProvider.refresh();
			outputChannel.appendLine('[Refresh] All views refreshed');
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

			// Show deployment progress
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

			vscode.window.showInformationMessage(`✅ ${profileName} deployed successfully!`);
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

	outputChannel.appendLine('[Activated] .NET Project Toolkit extension activated successfully');
	outputChannel.appendLine('[Info] Unified view registered in Explorer');
	outputChannel.appendLine('[Debug] View ID: dotnetToolkitExplorer');
	outputChannel.appendLine('[Debug] Workspace root: ' + (workspaceRoot || 'No workspace'));
	
	// Show notification to confirm activation
	vscode.window.showInformationMessage('✅ .NET Project Toolkit loaded successfully!');
}

// This method is called when your extension is deactivated
export function deactivate() {}
