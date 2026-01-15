import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { ProjectInfo } from '../models/ProjectModels';
import { IProfileService, ProfileWizardData } from '../services/ProfileService';

/**
 * Create Profile Command
 * Handles the multi-step wizard to create a new publish profile
 */
export class CreateProfileCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.createPublishProfile';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly profileService: IProfileService,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(item?: unknown): Promise<void> {
        const treeItem = item as { projectInfo?: ProjectInfo };
        const projectInfo = treeItem?.projectInfo;

        if (!projectInfo) {
            vscode.window.showErrorMessage('No project information available');
            return;
        }

        this.log(`Starting wizard for: ${projectInfo.name}`);

        // Collect profile data
        const data = await this.collectProfileData();
        if (!data) {
            this.log('Wizard cancelled');
            return;
        }

        // Create profile
        const profilePath = await this.profileService.create(projectInfo, data);

        if (profilePath) {
            vscode.window.showInformationMessage(`✅ Profile "${data.profileName}" created!`);
            this.onRefresh();
            this.log(`✓ Created: ${profilePath}`);
        } else {
            this.log('Failed to create profile');
        }
    }

    private async collectProfileData(): Promise<ProfileWizardData | undefined> {
        // Step 1: Profile name
        const profileName = await vscode.window.showInputBox({
            prompt: 'Enter profile name (e.g., uat-api, prod-web)',
            placeHolder: 'uat-api',
            validateInput: v => {
                if (!v?.trim()) return 'Required';
                if (!/^[a-zA-Z0-9-_]+$/.test(v)) return 'Only letters, numbers, hyphens, underscores';
                return null;
            }
        });
        if (!profileName) return undefined;

        // Step 2: Environment
        const env = await vscode.window.showQuickPick([
            { label: 'UAT', value: 'uat' as const, description: 'User Acceptance Testing' },
            { label: 'PROD', value: 'prod' as const, description: 'Production ⚠️' },
            { label: 'DEV', value: 'dev' as const, description: 'Development' },
        ], { placeHolder: 'Select environment' });
        if (!env) return undefined;

        // Step 3: Publish URL
        const publishUrl = await vscode.window.showInputBox({
            prompt: 'Enter publish URL (IP or domain)',
            placeHolder: '192.168.10.3',
            validateInput: v => !v?.trim() ? 'Required' : null
        });
        if (!publishUrl) return undefined;

        // Step 4: Site name
        const siteName = await vscode.window.showInputBox({
            prompt: 'Enter IIS site name',
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
            prompt: 'Deployment password',
            password: true,
            validateInput: v => !v?.trim() ? 'Required' : null
        });
        if (!password) return undefined;

        return {
            profileName,
            environment: env.value,
            publishUrl,
            siteName,
            username,
            password,
            siteUrl: siteUrl || undefined
        };
    }
}
