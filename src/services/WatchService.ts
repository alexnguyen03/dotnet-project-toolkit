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
    public readonly onDidChangeRunningWatches: vscode.Event<void> = this._onDidChangeRunningWatches.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Listen for terminal close events to update our state
        context.subscriptions.push(vscode.window.onDidCloseTerminal(terminal => {
            this.handleTerminalClosed(terminal);
        }));
    }

    private normalizePath(p: string): string {
        return vscode.Uri.file(p).fsPath.toLowerCase(); // Normalize for Windows
    }

    /**
     * Start `dotnet watch` for a single project
     */
    public async runWatch(project: ProjectInfo, additionalArgs?: string): Promise<void> {
        const key = this.normalizePath(project.csprojPath);

        if (this.runningWatches.has(key)) {
            vscode.window.showWarningMessage(`Watch is already running for ${project.name}`);
            this.focusWatch(project.csprojPath);
            return;
        }

        // Pre-flight check for SDK availability and global.json compatibility
        if (!await this.checkSdk(project.projectDir)) {
            return;
        }

        const terminalName = `Watch: ${project.name}`;
        const terminal = vscode.window.createTerminal({
            name: terminalName,
            cwd: project.projectDir
        });

        // Add to tracking before showing to avoid race conditions if clear happens
        this.runningWatches.set(key, {
            csprojPath: project.csprojPath,
            terminal: terminal,
            projectName: project.name
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
            const project = allProjects.find(p => p.name === projectNameOrId);
            if (project) {
                // Determine if we need to run this project (might already be running)
                if (!this.isProjectRunning(project.csprojPath)) {
                    await this.runWatch(project, group.arguments);
                }
            } else {
                vscode.window.showErrorMessage(`Project '${projectNameOrId}' not found in current workspace.`);
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
        watches.forEach(w => w.terminal.dispose());
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

        return group.projects.every(projectName => {
            const project = allProjects.find(p => p.name === projectName);
            return project && this.isProjectRunning(project.csprojPath);
        });
    }

    public stopGroup(group: WatchGroup, allProjects: ProjectInfo[]): void {
        group.projects.forEach(projectName => {
            const project = allProjects.find(p => p.name === projectName);
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
                    vscode.env.openExternal(vscode.Uri.parse('https://aka.ms/dotnet/sdk-not-found'));
                } else if (action === 'Download SDK') {
                    vscode.env.openExternal(vscode.Uri.parse('https://main-icon.microsoft.com/download'));
                }
                return false;
            } else if (stderr.includes('not recognized') || stderr.includes('command not found')) {
                vscode.window.showErrorMessage('❌ .NET SDK not found. Please ensure .NET is installed and in your PATH.');
                return false;
            }
            return true;
        }
    }
}
