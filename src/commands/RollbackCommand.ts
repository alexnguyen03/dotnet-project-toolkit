import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { HistoryTreeItem } from '../ui/history/HistoryTreeProvider';
import { HistoryManager } from '../services/HistoryManager';
import { DeploymentRecord } from '../models/DeploymentRecord';

export class RollbackCommand implements ICommand {
	readonly id = 'dotnet-project-toolkit.rollback';

	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly historyManager: HistoryManager,
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

		vscode.window.showInformationMessage(
			'Rollback feature requires project path configuration'
		);
		this.outputChannel.appendLine(`[Rollback] Requested rollback to: ${record.id}`);
		this.outputChannel.appendLine(`[Rollback] Backup path: ${record.backupPath}`);
	}
}
