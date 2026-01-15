import * as vscode from 'vscode';

/**
 * Command interface - Command Pattern
 * All commands implement this interface for consistent execution
 */
export interface ICommand {
    /**
     * Unique command identifier (matches package.json command id)
     */
    readonly id: string;

    /**
     * Execute the command
     * @param item Optional tree item passed from context menu
     */
    execute(item?: unknown): Promise<void>;
}

/**
 * Base command class with common utilities
 */
export abstract class BaseCommand implements ICommand {
    abstract readonly id: string;

    constructor(
        protected readonly outputChannel: vscode.OutputChannel
    ) {}

    abstract execute(item?: unknown): Promise<void>;

    protected log(message: string): void {
        this.outputChannel.appendLine(`[${this.getCommandName()}] ${message}`);
    }

    protected getCommandName(): string {
        return this.id.split('.').pop() || 'Command';
    }
}
