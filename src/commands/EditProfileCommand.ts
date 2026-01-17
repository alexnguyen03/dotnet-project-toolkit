import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { PublishProfileInfo, DeployEnvironment } from '../models/ProjectModels';
import { IProfileService, ProfileWizardData } from '../services/ProfileService';

/**
 * Edit Profile Command
 * Opens a wizard to edit an existing publish profile
 */
export class EditProfileCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.editPublishProfile';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly profileService: IProfileService,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(item?: unknown): Promise<void> {
        const treeItem = item as { profileInfo?: PublishProfileInfo; projectName?: string };
        const profileInfo = treeItem?.profileInfo;
        const projectName = treeItem?.projectName;

        if (!profileInfo) {
            vscode.window.showErrorMessage('No profile information available');
            return;
        }

        this.log(`Editing: ${profileInfo.fileName}`);

        // Parse existing profile to get current values
        const existingData = this.profileService.parse(profileInfo.path);
        if (!existingData) {
            vscode.window.showErrorMessage('Failed to read profile');
            return;
        }

        // Collect updated data (pre-fill with existing values)
        const data = await this.collectProfileData(existingData);
        if (!data) {
            this.log('Edit cancelled');
            return;
        }

        // Update profile by deleting and recreating
        // (simpler than parsing and modifying XML)
        const projectInfo = {
            name: projectName || 'Project',
            projectDir: profileInfo.path.replace(/[\\\/]Properties[\\\/]PublishProfiles[\\\/][^\\\/]+$/, ''),
            csprojPath: '', // Will use detectTargetFramework fallback
            projectType: 'unknown' as const,
            profiles: []
        };

        const success = await this.profileService.create(projectInfo, data);

        if (success) {
            vscode.window.showInformationMessage(`✅ Profile "${data.profileName}" updated!`);
            this.onRefresh();
            this.log(`✓ Updated: ${data.profileName}`);
        } else {
            vscode.window.showErrorMessage('Failed to update profile');
        }
    }

    private async collectProfileData(existing: PublishProfileInfo): Promise<ProfileWizardData | undefined> {
        // Step 1: Profile name (readonly, show current)
        const profileName = existing.fileName;

        vscode.window.showInformationMessage(`Editing profile: ${profileName}`);

        // Step 2: Environment
        const currentEnv = existing.environment === DeployEnvironment.Unknown ? DeployEnvironment.Staging : existing.environment;
        const env = await vscode.window.showQuickPick([
            { label: 'Staging', value: DeployEnvironment.Staging, description: currentEnv === DeployEnvironment.Staging ? '(current)' : '' },
            { label: 'Production', value: DeployEnvironment.Production, description: currentEnv === DeployEnvironment.Production ? '(current)' : '' },
            { label: 'Development', value: DeployEnvironment.Development, description: currentEnv === DeployEnvironment.Development ? '(current)' : '' },
        ], { placeHolder: `Current: ${currentEnv.toUpperCase()}` });
        if (!env) return undefined;

        // Step 3: Publish URL
        const publishUrl = await vscode.window.showInputBox({
            prompt: 'Publish URL (IP or domain)',
            value: existing.publishUrl || '',
            validateInput: v => !v?.trim() ? 'Required' : null
        });
        if (!publishUrl) return undefined;

        // Step 4: Site name
        const siteName = await vscode.window.showInputBox({
            prompt: 'IIS site name',
            placeHolder: 'TS_BUDGETCTRL_API_UAT',
            validateInput: v => !v?.trim() ? 'Required' : null
        });
        if (!siteName) return undefined;

        // Step 5: Site URL (optional)
        const siteUrl = await vscode.window.showInputBox({
            prompt: 'Site URL for browser launch (optional)',
            placeHolder: 'https://example.com'
        });

        // Step 6: Username
        const username = await vscode.window.showInputBox({
            prompt: 'Deployment username',
            placeHolder: 'namnh',
            validateInput: v => !v?.trim() ? 'Required' : null
        });
        if (!username) return undefined;

        // Step 7: Password
        const password = await vscode.window.showInputBox({
            prompt: 'Deployment password (leave empty to keep existing)',
            password: true
        });

        // If no password entered, we need to handle this differently
        // For now, require password
        if (!password) {
            const keepExisting = await vscode.window.showQuickPick(
                ['Keep existing password', 'Cancel'],
                { placeHolder: 'No password entered' }
            );
            if (keepExisting !== 'Keep existing password') return undefined;
        }

        return {
            profileName,
            environment: env.value,
            publishUrl,
            siteName,
            username,
            password: password || 'KEEP_EXISTING', // Marker for keeping existing
            siteUrl: siteUrl || undefined
        };
    }
}
