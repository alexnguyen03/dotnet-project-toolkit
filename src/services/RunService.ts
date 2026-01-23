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
			// Rewatch: stop and start watch again
			this.watchService.stopWatch(project.csprojPath);
			await new Promise((resolve) => setTimeout(resolve, 500));
			await this.watchService.runWatch(project);
			vscode.window.showInformationMessage(`Restarted watch for ${project.name}`);
		} else if (currentState === 'debugging') {
			// Redebug: stop and start debug again
			await this.debugService.stopDebugging(project.csprojPath);
			await new Promise((resolve) => setTimeout(resolve, 500));
			await this.debugService.startDebugging(project);
			vscode.window.showInformationMessage(`Restarted debug for ${project.name}`);
		} else {
			vscode.window.showWarningMessage(`${project.name} is not running`);
		}
	}

	/**
	 * Stop all running processes
	 */
	public async stopAll(): Promise<void> {
		this.watchService.stopAll();
		await this.debugService.stopAll();
	}
}
