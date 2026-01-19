import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IProfileService } from '../services/ProfileService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';

/**
 * Delete Profile Command
 * Handles deleting a publish profile with confirmation
 */
export class DeleteProfileCommand extends BaseCommand {
	readonly id = 'dotnet-project-toolkit.deletePublishProfile';

	constructor(
		outputChannel: vscode.OutputChannel,
		private readonly profileService: IProfileService,
		private readonly passwordStorage: IPasswordStorage,
		private readonly onRefresh: () => void
	) {
		super(outputChannel);
	}

	async execute(item?: unknown): Promise<void> {
		const treeItem = item as { profileInfo?: PublishProfileInfo; projectName?: string };
		const profileInfo = treeItem?.profileInfo;
		const projectName = treeItem?.projectName || 'Project';

		if (!profileInfo) {
			vscode.window.showErrorMessage('No profile information available');
			return;
		}

		// Confirm deletion
		const message = profileInfo.isProduction
			? `⚠️ DELETE PRODUCTION PROFILE "${profileInfo.fileName}"?\n\nThis cannot be undone!`
			: `Delete profile "${profileInfo.fileName}"?`;

		const answer = await vscode.window.showWarningMessage(
			message,
			{ modal: true },
			'Delete',
			'Cancel'
		);

		if (answer !== 'Delete') {
			this.log(`Cancelled: ${profileInfo.fileName}`);
			return;
		}

		// Delete profile
		const success = await this.profileService.delete(profileInfo);

		if (success) {
			// Delete password
			const passwordKey = this.passwordStorage.generateKey(projectName, profileInfo.fileName);
			await this.passwordStorage.delete(passwordKey);
			this.log(`Password key removed: ${passwordKey}`);

			vscode.window.showInformationMessage(`✅ Profile "${profileInfo.fileName}" deleted!`);
			this.onRefresh();
			this.log(`✓ Deleted: ${profileInfo.fileName}`);
		} else {
			vscode.window.showErrorMessage('Failed to delete profile');
		}
	}
}
