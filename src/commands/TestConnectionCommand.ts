import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { PublishTreeItem } from '../ui/publish/PublishTreeProvider';
import { ConnectionTester } from '../utils/ConnectionTester';

/**
 * Test Connection Command
 * Tests connectivity to the deployment target (IIS/FileSystem)
 */
export class TestConnectionCommand implements ICommand {
    readonly id = 'dotnet-project-toolkit.testConnection';

    constructor(private readonly outputChannel: vscode.OutputChannel) { }

    async execute(item: PublishTreeItem): Promise<void> {
        if (!item || !item.profileInfo) {
            vscode.window.showErrorMessage('No publish profile selected');
            return;
        }

        const profile = item.profileInfo;
        this.outputChannel.appendLine(`[TestConnection] Testing connection for profile: ${profile.name}`);
        this.outputChannel.appendLine(`[TestConnection] Method: ${profile.publishMethod}`);
        this.outputChannel.appendLine(`[TestConnection] Publish URL: ${profile.publishUrl}`);

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Testing connection to ${profile.name}...`,
                cancellable: false,
            },
            async (progress) => {
                try {
                    const result = await ConnectionTester.testConnection(profile, this.outputChannel);

                    if (result.success) {
                        vscode.window.showInformationMessage(`✅ Connection successful: ${result.message}`);
                    } else {
                        vscode.window.showErrorMessage(`❌ Connection failed: ${result.message}`);
                    }
                } catch (error: any) {
                    vscode.window.showErrorMessage(`❌ Connection error: ${error.message}`);
                }
            }
        );
    }
}
