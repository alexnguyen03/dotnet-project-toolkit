import * as vscode from 'vscode';
import { IConfigurationService } from './IConfigurationService';

/**
 * Configuration Service Implementation
 * Wraps VS Code workspace configuration
 */
export class ConfigurationService implements IConfigurationService {
    private readonly configSection = 'dotnetToolkit';

    getPasswordStorageType(): string {
        return vscode.workspace.getConfiguration(this.configSection).get<string>('passwordStorage', 'secret');
    }

    getHistoryMaxEntries(): number {
        return vscode.workspace.getConfiguration(this.configSection).get<number>('historyMaxEntries', 50);
    }

    getWorkspaceRoot(): string | undefined {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }
}
