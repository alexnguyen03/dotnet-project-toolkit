// The module 'vscode' contains the VS Code extensibility API
import * as vscode from 'vscode';
import { ServiceContainer } from './container/ServiceContainer';

/**
 * Extension activation
 * Clean entry point following SOLID principles
 */
export function activate(context: vscode.ExtensionContext) {
	// console.log('.NET Project Toolkit is now active!');

	// Initialize all services and commands through DI container
	const container = ServiceContainer.initialize(context);

	// Log activation
	container.outputChannel.appendLine('[Activated] .NET Project Toolkit extension activated');
	container.outputChannel.appendLine(
		`[Config] Password storage: ${container.passwordStorage.type}`
	);

	// Show notification
	// vscode.window.showInformationMessage('✅ .NET Project Toolkit loaded successfully!');
}

/**
 * Extension deactivation
 */
export function deactivate() {}
