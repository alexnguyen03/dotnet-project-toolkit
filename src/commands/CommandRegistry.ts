import * as vscode from 'vscode';
import { ICommand } from './ICommand';

/**
 * Command Registry - Registers all commands with VS Code
 * Single place to manage all command registrations
 */
export class CommandRegistry {
	private commands: Map<string, ICommand> = new Map();

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outputChannel: vscode.OutputChannel
	) {}

	/**
	 * Register a command with VS Code
	 */
	register(command: ICommand): void {
		this.commands.set(command.id, command);

		const disposable = vscode.commands.registerCommand(command.id, async (item?: unknown) => {
			try {
				await command.execute(item);
			} catch (error) {
				this.outputChannel.appendLine(`[CommandError] ${command.id}: ${error}`);
				vscode.window.showErrorMessage(`Command failed: ${error}`);
			}
		});

		this.context.subscriptions.push(disposable);
		this.outputChannel.appendLine(`[Registry] Registered: ${command.id}`);
	}

	/**
	 * Register multiple commands
	 */
	registerAll(commands: ICommand[]): void {
		commands.forEach((cmd) => this.register(cmd));
	}

	/**
	 * Get a registered command by id
	 */
	get(id: string): ICommand | undefined {
		return this.commands.get(id);
	}
}
