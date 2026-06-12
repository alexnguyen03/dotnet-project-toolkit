import * as vscode from 'vscode';
import { WatchService } from './WatchService';
import { DebugService } from './DebugService';
import { ProjectInfo } from '../models/ProjectModels';

export type ProjectRunState = 'idle' | 'watching' | 'debugging';

/**
 * RunService - Coordinates between Watch and Debug services
 * Ensures only one mode is active at a time per project
 */
export class RunService {
	private _onDidChangeState: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
	public readonly onDidChangeState: vscode.Event<void> = this._onDidChangeState.event;

	constructor(
		private readonly watchService: WatchService,
		private readonly debugService: DebugService
	) {
		// Listen to both services for state changes
		this.watchService.onDidChangeRunningWatches(() => this._onDidChangeState.fire());
		this.debugService.onDidChangeDebugSessions(() => this._onDidChangeState.fire());
	}

	/**
	 * Get current state of a project
	 */
	public getProjectState(csprojPath: string): ProjectRunState {
		if (this.watchService.isProjectRunning(csprojPath)) {
			return 'watching';
		}
		if (this.debugService.isProjectDebugging(csprojPath)) {
			return 'debugging';
		}
		return 'idle';
	}

	/**
	 * Start watch mode - stops debug if running
	 */
	public async startWatch(project: ProjectInfo): Promise<void> {
		const currentState = this.getProjectState(project.csprojPath);

		// If already watching, do nothing
		if (currentState === 'watching') {
			vscode.window.showInformationMessage(`${project.name} is already being watched`);
			return;
		}

		// Stop debug if running
		if (currentState === 'debugging') {
			await this.debugService.stopDebugging(project.csprojPath);
			// Wait a bit for cleanup
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// Start watch
		await this.watchService.runWatch(project);
	}

	/**
	 * Start debug mode - stops watch if running
	 */
	public async startDebug(project: ProjectInfo): Promise<void> {
		const currentState = this.getProjectState(project.csprojPath);

		// If already debugging, do nothing
		if (currentState === 'debugging') {
			vscode.window.showInformationMessage(`${project.name} is already being debugged`);
			return;
		}

		// Stop watch if running
		if (currentState === 'watching') {
			this.watchService.stopWatch(project.csprojPath);
			// Wait a bit for cleanup
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		// Start debug
		await this.debugService.startDebugging(project);
	}

	/**
	 * Stop watch mode
	 */
	public stopWatch(csprojPath: string): void {
		this.watchService.stopWatch(csprojPath);
	}

	/**
	 * Stop debug mode
	 */
	public async stopDebug(csprojPath: string): Promise<void> {
		await this.debugService.stopDebugging(csprojPath);
	}

	/**
	 * Reload/restart current process
	 */
	public async reload(project: ProjectInfo): Promise<void> {
		const currentState = this.getProjectState(project.csprojPath);

		if (currentState === 'watching') {
			const success = this.watchService.restartWatch(project.csprojPath);
			if (success) {
				vscode.window.showInformationMessage(
					`Restarted watch (Ctrl+R) for ${project.name}`
				);
			} else {
				await this.watchService.runWatch(project);
				vscode.window.showInformationMessage(`Started watch for ${project.name}`);
			}
		} else if (currentState === 'debugging') {
			await this.debugService.restartDebugging(project);
			vscode.window.showInformationMessage(`Restarted debug session for ${project.name}`);
		} else {
			vscode.window.showWarningMessage(`${project.name} is not running`);
		}
	}

	/**
	 * Run a dotnet CLI command for a project in a terminal
	 */
	private runTerminalCommand(
		project: ProjectInfo,
		command: string | string[],
		actionName: string
	): void {
		const terminalName = `${actionName}: ${project.name}`;
		let terminal = vscode.window.terminals.find((t) => t.name === terminalName);

		if (!terminal) {
			terminal = vscode.window.createTerminal({
				name: terminalName,
				cwd: project.projectDir,
			});
		}

		terminal.show();
		if (Array.isArray(command)) {
			command.forEach((cmd) => terminal.sendText(cmd));
		} else {
			terminal.sendText(command);
		}
	}

	/**
	 * Build project
	 */
	public buildProject(project: ProjectInfo): void {
		this.runTerminalCommand(project, `dotnet build "${project.csprojPath}"`, 'Build');
	}

	/**
	 * Clean project
	 */
	public cleanProject(project: ProjectInfo): void {
		this.runTerminalCommand(project, `dotnet clean "${project.csprojPath}"`, 'Clean');
	}

	/**
	 * Rebuild project (clean followed by build)
	 */
	public rebuildProject(project: ProjectInfo): void {
		this.runTerminalCommand(
			project,
			[`dotnet clean "${project.csprojPath}"`, `dotnet build "${project.csprojPath}"`],
			'Rebuild'
		);
	}

	/**
	 * Restore project
	 */
	public restoreProject(project: ProjectInfo): void {
		this.runTerminalCommand(project, `dotnet restore "${project.csprojPath}"`, 'Restore');
	}

	/**
	 * Stop all running processes
	 */
	public async stopAll(): Promise<void> {
		this.watchService.stopAll();
		await this.debugService.stopAll();
	}
}
