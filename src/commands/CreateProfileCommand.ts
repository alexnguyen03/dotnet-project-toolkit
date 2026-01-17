import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { ProjectInfo } from '../models/ProjectModels';
import { IProfileService } from '../services/ProfileService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { ProfileInfoPanel } from '../ui/ProfileInfoPanel';

/**
 * Create Profile Command
 * improved: Opens the Profile Info Panel in "Create" mode
 */
export class CreateProfileCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.createPublishProfile';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly extensionUri: vscode.Uri,
        private readonly profileService: IProfileService,
        private readonly passwordStorage: IPasswordStorage,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(item?: unknown): Promise<void> {
        const treeItem = item as { projectInfo?: ProjectInfo };
        const projectInfo = treeItem?.projectInfo;

        if (!projectInfo) {
            vscode.window.showErrorMessage('No project information available. Please select a project to add a profile to.');
            return;
        }

        this.log(`Opening Create Profile panel for: ${projectInfo.name}`);

        // Open panel in Create Mode
        ProfileInfoPanel.showCreate(
            this.extensionUri,
            projectInfo.name,
            projectInfo.projectDir,
            this.profileService,
            this.passwordStorage,
            this.outputChannel,
            this.onRefresh
        );
    }
}
