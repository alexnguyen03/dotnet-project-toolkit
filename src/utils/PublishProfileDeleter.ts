import * as vscode from 'vscode';
import * as fs from 'fs';
import { PublishProfileInfo } from '../models/ProjectModels';
import { EnvironmentManager } from './EnvironmentManager';

/**
 * Deletes publish profiles and their associated environment variables
 */
export class PublishProfileDeleter {
    private envManager: EnvironmentManager;

    constructor() {
        this.envManager = new EnvironmentManager();
    }

    /**
     * Delete a publish profile with confirmation
     */
    async deleteProfile(profileInfo: PublishProfileInfo, projectName: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
        try {
            // Confirm deletion
            const confirmMessage = profileInfo.isProduction
                ? `⚠️ DELETE PRODUCTION PROFILE "${profileInfo.fileName}"?\n\nThis will delete:\n- .pubxml file\n- Password environment variable\n\nThis action cannot be undone!`
                : `Delete profile "${profileInfo.fileName}"?\n\nThis will delete:\n- .pubxml file\n- Password environment variable`;

            const answer = await vscode.window.showWarningMessage(
                confirmMessage,
                { modal: true },
                'Delete',
                'Cancel'
            );

            if (answer !== 'Delete') {
                outputChannel.appendLine(`[DeleteProfile] Deletion cancelled by user`);
                return false;
            }

            // Delete .pubxml file
            if (fs.existsSync(profileInfo.path)) {
                fs.unlinkSync(profileInfo.path);
                outputChannel.appendLine(`[DeleteProfile] ✓ Deleted file: ${profileInfo.path}`);
            }

            // Show password variable (needs manual cleanup)
            const passwordVarName = this.envManager.generatePasswordVarName(projectName, profileInfo.fileName);
            outputChannel.appendLine(`[DeleteProfile] Password variable: ${passwordVarName}`);
            outputChannel.appendLine(`[DeleteProfile] NOTE: Windows users should manually delete the env var or restart terminal`);

            vscode.window.showInformationMessage(
                `✅ Profile "${profileInfo.fileName}" deleted successfully!`,
                'OK'
            );

            return true;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to delete profile: ${error}`);
            outputChannel.appendLine(`[DeleteProfile] Error: ${error}`);
            return false;
        }
    }
}
