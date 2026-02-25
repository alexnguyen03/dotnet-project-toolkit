import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as util from 'util';
import { WatchGroup } from '../models/WatchModels';
import { ProjectInfo } from '../models/ProjectModels';

const exec = util.promisify(cp.exec);

interface RunningWatch {
	csprojPath: string;
	terminal: vscode.Terminal;
	projectName: string;
}

export class WatchService {
	private runningWatches: Map<string, RunningWatch> = new Map();
	private _onDidChangeRunningWatches: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeRunningWatches: vscode.Event<void> =
		this._onDidChangeRunningWatches.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Listen for terminal close events to update our state
		context.subscriptions.push(
			vscode.window.onDidCloseTerminal((terminal) => {
				this.handleTerminalClosed(terminal);
			})
		);
	}

	private normalizePath(p: string): string {
		return vscode.Uri.file(p).fsPath.toLowerCase(); // Normalize for Windows
	}

	/**
	 * Start `dotnet watch` for a single project
	 */
	/**
	 * Start `dotnet watch` for a single project
	 */
	public async runWatch(project: ProjectInfo, additionalArgs?: string): Promise<void> {
		const key = this.normalizePath(project.csprojPath);
		const terminalName = `Watch: ${project.name}`;

		// Try to find an existing terminal to reuse
		// First check our tracked list
		let terminal = this.runningWatches.get(key)?.terminal;

		// If not in tracked list, check all validation terminals for one with the matching name
		if (!terminal) {
			terminal = vscode.window.terminals.find((t) => t.name === terminalName);
		}

		if (terminal) {
			// If reusing, send Ctrl+C to stop any potential running process
			terminal.sendText('\u0003');
		} else {
			// Only perform SDK check if we're creating a fresh terminal environment
			// (If terminal exists, we assume SDK was fine before)
			if (!(await this.checkSdk(project.projectDir))) {
				return;
			}

			terminal = vscode.window.createTerminal({
				name: terminalName,
				cwd: project.projectDir,
			});
		}

		// Update tracking (always overwrite to ensure latest state)
		this.runningWatches.set(key, {
			csprojPath: project.csprojPath,
			terminal: terminal,
			projectName: project.name,
		});

		terminal.show();

		// Build command: dotnet watch run --project <path> [args]
		// We use --project to be explicit
		let command = `dotnet watch run --project "${project.csprojPath}"`;

		if (additionalArgs) {
			command += ` ${additionalArgs}`;
		}

		terminal.sendText(command);
		this._onDidChangeRunningWatches.fire();
	}

	/**
	 * Run all projects in a group
	 */
	public async runGroup(group: WatchGroup, allProjects: ProjectInfo[]): Promise<void> {
		for (const projectNameOrId of group.projects) {
			const project = allProjects.find((p) => p.name === projectNameOrId);
			if (project) {
				// Determine if we need to run this project (might already be running)
				if (!this.isProjectRunning(project.csprojPath)) {
					await this.runWatch(project, group.arguments);

					// Wait 3 seconds before starting next project to avoid file locking conflicts
					// This gives the previous process time to release file handles
					await new Promise((resolve) => setTimeout(resolve, 3000));
				}
			} else {
				vscode.window.showErrorMessage(
					`Project '${projectNameOrId}' not found in current workspace.`
				);
			}
		}
	}

	/**
	 * Stop watch for a specific project
	 */
	public stopWatch(csprojPath: string): void {
		const key = this.normalizePath(csprojPath);
		const watch = this.runningWatches.get(key);
		if (watch) {
			watch.terminal.dispose();
		}
	}

	/**
	 * Stop all running watches
	 */
	public stopAll(): void {
		const watches = Array.from(this.runningWatches.values());
		watches.forEach((w) => w.terminal.dispose());
	}

	/**
	 * Focus the terminal for a running watch
	 */
	public focusWatch(csprojPath: string): void {
		const key = this.normalizePath(csprojPath);
		const watch = this.runningWatches.get(key);
		if (watch) {
			watch.terminal.show();
		}
	}

	public isProjectRunning(csprojPath: string): boolean {
		return this.runningWatches.has(this.normalizePath(csprojPath));
	}

	public isGroupRunning(group: WatchGroup, allProjects: ProjectInfo[]): boolean {
		// Return true only if ALL projects in the group are currently running
		// This separates single-project runs from group runs conceptually
		if (group.projects.length === 0) return false;

		return group.projects.every((projectName) => {
			const project = allProjects.find((p) => p.name === projectName);
			return project && this.isProjectRunning(project.csprojPath);
		});
	}

	public stopGroup(group: WatchGroup, allProjects: ProjectInfo[]): void {
		group.projects.forEach((projectName) => {
			const project = allProjects.find((p) => p.name === projectName);
			if (project) {
				this.stopWatch(project.csprojPath);
			}
		});
	}

	public getRunningWatches(): RunningWatch[] {
		return Array.from(this.runningWatches.values());
	}

	public dispose() {
		this.stopAll();
	}

	private handleTerminalClosed(terminal: vscode.Terminal) {
		// Find which watch this terminal belongs to
		for (const [key, watch] of this.runningWatches.entries()) {
			if (watch.terminal === terminal) {
				this.runningWatches.delete(key);
				this._onDidChangeRunningWatches.fire();
				break;
			}
		}
	}

	/**
	 * Verify .NET SDK is available and compatible (handles global.json mismatch)
	 */
	private async checkSdk(cwd: string): Promise<boolean> {
		try {
			await exec('dotnet --list-sdks', { cwd: cwd });
			return true;
		} catch (error: any) {
			const stderr = error.stderr || error.message || '';
			if (stderr.includes('global.json') || stderr.includes('match an installed SDK')) {
				const action = await vscode.window.showErrorMessage(
					'❌ .NET SDK Version Mismatch: The version specified in global.json was not found.',
					'Learn More',
					'Download SDK'
				);
				if (action === 'Learn More') {
					vscode.env.openExternal(
						vscode.Uri.parse('https://aka.ms/dotnet/sdk-not-found')
					);
				} else if (action === 'Download SDK') {
					vscode.env.openExternal(
						vscode.Uri.parse('https://main-icon.microsoft.com/download')
					);
				}
				return false;
			} else if (stderr.includes('not recognized') || stderr.includes('command not found')) {
				vscode.window.showErrorMessage(
					'❌ .NET SDK not found. Please ensure .NET is installed and in your PATH.'
				);
				return false;
			}
			return true;
		}
	}
}
