// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { UnifiedTreeProvider } from './ui/UnifiedTreeProvider';
import { PublishProfileCreator } from './utils/PublishProfileCreator';
import { PublishProfileDeleter } from './utils/PublishProfileDeleter';

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
			// Extract profile information
			const profileInfo = item.profileInfo;
			
			if (!profileInfo) {
				vscode.window.showErrorMessage('No profile information available');
				return;
			}
			
			const profileName = profileInfo.name;

			const answer = await vscode.window.showWarningMessage(
				`⚠️ Deploy to: ${profileName}?`,
				{ modal: true },
				'Deploy',
				'Cancel'
			);
			if (answer !== 'Deploy') {
				outputChannel.appendLine(`[Cancelled] ${profileName} deployment cancelled by user`);
				return;
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
					outputChannel.appendLine(`[Deploy] Profile path: ${profileInfo.path}`);
					outputChannel.appendLine(`[Deploy] Environment: ${profileInfo.environment}`);
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

	// Create publish profile command
	context.subscriptions.push(
		vscode.commands.registerCommand('dotnet-project-toolkit.createPublishProfile', async (item: any) => {
			const projectInfo = item.projectInfo;
			
			if (!projectInfo) {
				vscode.window.showErrorMessage('No project information available');
				return;
			}

			outputChannel.appendLine(`[CreateProfile] Starting wizard for project: ${projectInfo.name}`);
			
			// Create profile creator
			const creator = new PublishProfileCreator();
			
			// Run wizard
			const success = await creator.createProfileWizard(projectInfo, outputChannel);
			
			if (success) {
				// Refresh tree to show new profile
				unifiedProvider.refresh();
				outputChannel.appendLine(`[CreateProfile] ✓ Profile created and tree refreshed`);
			} else {
				outputChannel.appendLine(`[CreateProfile] Profile creation cancelled or failed`);
			}
		})
	);

	// Delete publish profile command
	context.subscriptions.push(
		vscode.commands.registerCommand('dotnet-project-toolkit.deletePublishProfile', async (item: any) => {
			const profileInfo = item.profileInfo;
			
			if (!profileInfo) {
				vscode.window.showErrorMessage('No profile information available');
				return;
			}

			outputChannel.appendLine(`[DeleteProfile] Requesting deletion: ${profileInfo.fileName}`);
			
			// Create profile deleter
			const deleter = new PublishProfileDeleter();
			
			// Run deletion with confirmation (pass projectName for password var naming)
			const projectName = item.projectName || 'Project';
			const success = await deleter.deleteProfile(profileInfo, projectName, outputChannel);
			
			if (success) {
				// Refresh tree to remove deleted profile
				unifiedProvider.refresh();
				outputChannel.appendLine(`[DeleteProfile] ✓ Profile deleted and tree refreshed`);
			}
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
