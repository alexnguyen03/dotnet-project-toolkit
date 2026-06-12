import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { HistoryTreeItem } from '../ui/history/HistoryTreeProvider';
import { HistoryManager } from '../services/HistoryManager';
import { DeploymentRecord } from '../models/DeploymentRecord';
import { IRollbackService } from '../services/RollbackService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import * as path from 'path';

export class RollbackCommand implements ICommand {
	readonly id = 'dotnet-project-toolkit.rollback';

	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly historyManager: HistoryManager,
		private readonly rollbackService: IRollbackService,
		private readonly passwordStorage: IPasswordStorage,
		private readonly onRefresh: () => void
	) {}

	async execute(item: HistoryTreeItem): Promise<void> {
		if (!item || !item.record) {
			vscode.window.showErrorMessage('No deployment record selected');
			return;
		}

		const record = item.record;

		if (record.status !== 'success') {
			vscode.window.showErrorMessage('Can only rollback successful deployments');
			return;
		}

		if (!record.backupPath) {
			vscode.window.showErrorMessage('No backup available for this deployment');
			return;
		}

		const confirm = await vscode.window.showWarningMessage(
			`⚠️ Rollback ${record.projectName} (${record.profileName}) to this version?`,
			{ modal: true },
			'Rollback',
			'Cancel'
		);

		if (confirm !== 'Rollback') {
			return;
		}

		// Retrieve password
		const passwordKey = this.passwordStorage.generateKey(record.projectName, record.profileName);
		const password = await this.passwordStorage.retrieve(passwordKey);

		if (!password) {
			vscode.window.showErrorMessage(
				`Password not found for profile ${record.profileName}. Cannot rollback.`
			);
			return;
		}

		this.outputChannel.show();
		this.outputChannel.appendLine(`[Rollback] Requested manual rollback to: ${record.id}`);
		this.outputChannel.appendLine(`[Rollback] Backup path: ${record.backupPath}`);

		// Get project path. We might not have the projectPath in the record natively, 
		// but we can try to find it by scanning the workspace or relying on a convention.
		// Wait, RollbackService.rollback requires projectPath.
		// Where can we get projectPath? We can try to use a workspace scan, or require the user to have a project selected,
		// but HistoryTreeItem just has a record. The profile path might be available.
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
		
		// Attempt to guess projectPath by projectName
		// We can do a quick search in workspaceRoot for [projectName].csproj
		// Or we can modify HistoryManager to store projectPath.
		// For now, let's just construct it if possible, or assume it's in the root
		const expectedProjectPath = path.join(workspaceRoot, record.projectName, `${record.projectName}.csproj`);
		const fallbackProjectPath = path.join(workspaceRoot, `${record.projectName}.csproj`);
		
		let projectPath = '';
		const fs = require('fs');
		if (fs.existsSync(expectedProjectPath)) {
			projectPath = expectedProjectPath;
		} else if (fs.existsSync(fallbackProjectPath)) {
			projectPath = fallbackProjectPath;
		} else {
			// Ask user to select project file
			const uri = await vscode.window.showOpenDialog({
				canSelectMany: false,
				openLabel: 'Select Project (.csproj)',
				filters: { 'Project Files': ['csproj'] },
			});
			if (uri && uri[0]) {
				projectPath = uri[0].fsPath;
			} else {
				vscode.window.showErrorMessage('Rollback requires project path configuration');
				return;
			}
		}

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Rolling back ${record.projectName}...`,
				cancellable: false,
			},
			async (progress) => {
				const dummyProfileInfo = {
					name: record.profileName,
					fileName: record.profileName,
					environment: record.environment as any,
					path: '',
					isProduction: record.environment?.toLowerCase() === 'production',
				};
				
				const result = await this.rollbackService.rollback(
					projectPath,
					record.projectName,
					dummyProfileInfo,
					password,
					record.backupPath!
				);

				if (result.success) {
					vscode.window.showInformationMessage(`✅ Successfully rolled back ${record.projectName}`);
					
					// Add a new history record for this rollback
					await this.historyManager.addDeployment(
						{
							profileName: record.profileName,
							projectName: record.projectName,
							environment: record.environment,
							status: 'success',
							startTime: new Date().toISOString(),
							endTime: new Date().toISOString(),
							isRollback: true,
							rollbackFromId: record.id
						},
						''
					);
				} else {
					vscode.window.showErrorMessage(`❌ Rollback failed: ${result.errorMessage}`);
				}
				
				this.onRefresh();
			}
		);
	}
}
