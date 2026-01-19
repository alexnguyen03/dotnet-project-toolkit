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
		this.onRefresh();
		this.log('All views refreshed');
	}
}
