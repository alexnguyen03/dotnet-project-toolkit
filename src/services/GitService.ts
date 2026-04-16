import * as vscode from 'vscode';
import { runProcess } from '../utils/ProcessRunner';

export class GitService {
	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly workspaceRoot: string
	) {}

	async getCurrentBranch(): Promise<string> {
		try {
			const output = await this.execute('git', ['branch', '--show-current']);
			return output.trim();
		} catch (error) {
			this.log(`Error getting current branch: ${error}`);
			return '';
		}
	}

	async isDirty(): Promise<boolean> {
		try {
			const output = await this.execute('git', ['status', '--porcelain']);
			return output.trim().length > 0;
		} catch (error) {
			this.log(`Error checking git status: ${error}`);
			return false;
		}
	}

	async checkout(branch: string): Promise<boolean> {
		try {
			await this.execute('git', ['checkout', branch]);
			return true;
		} catch (error) {
			this.log(`Error checking out branch ${branch}: ${error}`);
			return false;
		}
	}

	private async execute(command: string, args: string[]): Promise<string> {
		const result = await runProcess(command, args, {
			cwd: this.workspaceRoot,
			timeoutMs: 60000,
			maxOutputBytes: 1024 * 1024,
		});

		if (result.exitCode !== 0) {
			throw new Error(result.output || result.error || 'Command failed');
		}

		return result.output;
	}

	private log(message: string): void {
		this.outputChannel.appendLine(`[GitService] ${message}`);
	}
}
