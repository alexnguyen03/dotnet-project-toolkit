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

        this.log(`Starting create profile for: ${projectInfo.name}`);

        // Only ask for profile name
        const profileName = await vscode.window.showInputBox({
            prompt: 'Enter profile name (e.g., uat-api, prod-web)',
            placeHolder: 'uat-api',
            validateInput: v => {
                if (!v?.trim()) return 'Required';
                if (!/^[a-zA-Z0-9-_]+$/.test(v)) return 'Only letters, numbers, hyphens, underscores';
                return null;
            }
        });

        if (!profileName) {
            this.log('Create profile cancelled');
            return;
        }

        // Auto-detect environment or default to dev
        const lowerName = profileName.toLowerCase();
        let env: 'uat' | 'prod' | 'dev' = 'dev';
        if (lowerName.includes('uat')) env = 'uat';
        if (lowerName.includes('prod')) env = 'prod';

        this.log(`Opening profile panel for new profile: ${profileName}`);

        // Open ProfileInfoPanel in "create mode" with empty profile data
        await vscode.commands.executeCommand('dotnet-project-toolkit.createProfileWithPanel', {
            projectInfo: projectInfo,
            profileName: profileName,
            environment: env
        });
    }
}
