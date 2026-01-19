import * as vscode from 'vscode';
import { IConfigurationService } from './IConfigurationService';

/**
 * Configuration Service Implementation
 * Wraps VS Code workspace configuration
 */
export class ConfigurationService implements IConfigurationService {
	private readonly configSection = 'dotnetToolkit';
	private readonly workspaceSection = 'dotnetWorkspace';

	getPasswordStorageType(): string {
		return vscode.workspace
			.getConfiguration(this.configSection)
			.get<string>('passwordStorage', 'secret');
	}

	getDotnetPath(): string {
		return vscode.workspace
			.getConfiguration(this.workspaceSection)
			.get<string>('dotnetPath', 'dotnet');
	}

	getOpenBrowserOnDeploy(): boolean {
		return vscode.workspace
			.getConfiguration(this.configSection)
			.get<boolean>('openBrowserOnDeploy', true);
	}

	getWorkspaceRoot(): string | undefined {
		return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	}
}
