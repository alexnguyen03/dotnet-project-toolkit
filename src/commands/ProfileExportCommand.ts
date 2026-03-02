import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ICommand } from './ICommand';
import { PublishTreeItem } from '../ui/publish/PublishTreeProvider';
import { ProfileService } from '../services/ProfileService';

export class ProfileExportCommand implements ICommand {
	readonly id = 'dotnetProjectToolkit.exportPublishProfile';

	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly profileService: ProfileService
	) {}

	async execute(item: PublishTreeItem): Promise<void> {
		if (!item || !item.profileInfo) {
			vscode.window.showErrorMessage('No publish profile selected');
			return;
		}

		const profileInfo = item.profileInfo;

		if (!profileInfo.path || !fs.existsSync(profileInfo.path)) {
			vscode.window.showErrorMessage('Profile file not found');
			return;
		}

		try {
			const defaultFileName = path.basename(profileInfo.path);
			const uri = await vscode.window.showSaveDialog({
				title: 'Export Publish Profile',
				defaultUri: vscode.Uri.file(path.join(process.cwd(), defaultFileName)),
				filters: {
					'Publish Profile': ['pubxml'],
					'All Files': ['*'],
				},
			});

			if (!uri) {
				return;
			}

			const content = fs.readFileSync(profileInfo.path, 'utf-8');
			fs.writeFileSync(uri.fsPath, content, 'utf-8');

			vscode.window.showInformationMessage(`✅ Profile exported to: ${uri.fsPath}`);
			this.outputChannel.appendLine(`[Export] Profile exported to: ${uri.fsPath}`);
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to export profile: ${error.message}`);
			this.outputChannel.appendLine(`[Export] Error: ${error.message}`);
		}
	}
}
