import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IProfileService } from '../services/ProfileService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { HistoryManager } from '../services/HistoryManager';
import { ProfileInfoPanel } from '../ui/ProfileInfoPanel';

/**
 * Profile Info Command
 * Opens a Webview panel showing profile details with edit capability
 */
export class ProfileInfoCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.profileInfo';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly extensionUri: vscode.Uri,
        private readonly profileService: IProfileService,
        private readonly passwordStorage: IPasswordStorage,
        private readonly historyManager: HistoryManager,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(item?: unknown): Promise<void> {
        const treeItem = item as { 
            profileInfo?: PublishProfileInfo; 
            projectName?: string;
            projectPath?: string;
            csprojPath?: string;
        };
        const profileInfo = treeItem?.profileInfo;
        const projectName = treeItem?.projectName || 'Project';
        const projectPath = treeItem?.projectPath || treeItem?.csprojPath;

        if (!profileInfo) {
            vscode.window.showErrorMessage('No profile information available');
            return;
        }

        this.log(`Opening info panel: ${profileInfo.fileName}`);
        this.log(`Project: ${projectName}`);
        this.log(`Deployment Project Path: ${projectPath || 'NOT FOUND'}`);
        this.log(`Profile Path: ${profileInfo.path}`);

        ProfileInfoPanel.show(
            this.extensionUri,
            profileInfo,
            projectName,
            this.profileService,
            this.passwordStorage,
            this.historyManager,
            this.outputChannel,
            this.onRefresh
        );
    }
}
