import * as vscode from 'vscode';
import { BaseCommand } from './ICommand';

/**
 * Refresh Command
 * Refreshes all tree views
 */
export class RefreshCommand extends BaseCommand {
    readonly id = 'dotnet-project-toolkit.refreshProfiles';

    constructor(
        outputChannel: vscode.OutputChannel,
        private readonly onRefresh: () => void
    ) {
        super(outputChannel);
    }

    async execute(): Promise<void> {
        try {
            this.onRefresh();
            this.log('All views refreshed');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to refresh profiles: ${msg}`);
            this.log(`Error: ${msg}`);
        }
    }
}
