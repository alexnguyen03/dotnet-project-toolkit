import * as vscode from 'vscode';
import * as path from 'path';
import { DebugGroup } from '../models/DebugModels';
import { ProjectInfo } from '../models/ProjectModels';

interface ActiveDebugSession {
    sessionId: string;
    csprojPath: string;
    projectName: string;
}

export class DebugService {
    private activeSessions: Map<string, ActiveDebugSession> = new Map();
    private _onDidChangeDebugSessions: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeDebugSessions: vscode.Event<void> = this._onDidChangeDebugSessions.event;

    public readonly hasDebugger: boolean;

    constructor(private readonly context: vscode.ExtensionContext) {
        // Detect C# debugger extensions on initialization
        this.hasDebugger = this.detectDebugger();

        // Listen for debug session events
        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(session => {
                this.handleSessionStarted(session);
            })
        );

        context.subscriptions.push(
            vscode.debug.onDidTerminateDebugSession(session => {
                this.handleSessionTerminated(session);
            })
        );
    }

    /**
     * Detect if C# debugger extension is installed and active
     */
    private detectDebugger(): boolean {
        const extensions = vscode.extensions.all;
        const debuggerExt = extensions.find(ext =>
            ext.id === 'ms-dotnettools.csharp' ||
            ext.id === 'ms-dotnettools.csdevkit' ||
            ext.id === 'muhammad-sammy.csharp'
        );

        // Check if extension exists and is active
        return debuggerExt !== undefined && debuggerExt.isActive;
    }

    /**
     * Try to activate debugger extension if installed but not active
     */
    private async tryActivateDebugger(): Promise<boolean> {
        const extensions = vscode.extensions.all;
        const debuggerExt = extensions.find(ext =>
            ext.id === 'ms-dotnettools.csharp' ||
            ext.id === 'ms-dotnettools.csdevkit' ||
            ext.id === 'muhammad-sammy.csharp'
        );

        if (!debuggerExt) {
            return false;
        }

        if (!debuggerExt.isActive) {
            try {
                // Show progress while activating
                return await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Activating C# debugger...',
                    cancellable: false
                }, async (progress) => {
                    await debuggerExt.activate();

                    // Wait a bit for debugger to be fully ready
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    return debuggerExt.isActive;
                });
            } catch (error) {
                console.error('Failed to activate C# debugger extension:', error);
                vscode.window.showWarningMessage(
                    'C# debugger extension is still downloading dependencies. Please wait and try again, or use terminal mode.',
                    'Use Terminal'
                ).then(choice => {
                    if (choice === 'Use Terminal') {
                        // User will be prompted again in startDebugging
                    }
                });
                return false;
            }
        }

        return true;
    }

    private normalizePath(p: string): string {
        return vscode.Uri.file(p).fsPath.toLowerCase();
    }

    /**
     * Check if coreclr debugger is available
     */
    private async isDebuggerAvailable(): Promise<boolean> {
        try {
            // Try to get available debug types
            const debuggers = await vscode.debug.startDebugging(
                undefined,
                {
                    type: 'coreclr',
                    name: 'test',
                    request: 'launch',
                    program: 'test'
                }
            );
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Start debugging a single project
     */
    public async startDebugging(project: ProjectInfo): Promise<void> {
        const key = this.normalizePath(project.csprojPath);

        if (this.activeSessions.has(key)) {
            vscode.window.showWarningMessage(`${project.name} is already being debugged`);
            return;
        }

        if (!project.targetFramework) {
            vscode.window.showErrorMessage(`Cannot debug ${project.name}: TargetFramework not found in .csproj`);
            return;
        }

        // Try to activate debugger if installed but not active
        const debuggerActivated = await this.tryActivateDebugger();

        // Check if debugger is available
        if (!debuggerActivated) {
            // Fallback to terminal-based execution
            const answer = await vscode.window.showInformationMessage(
                'No C# debugger extension detected or failed to activate. Run in terminal instead?',
                'Run in Terminal',
                'Install Debugger',
                'Cancel'
            );

            if (answer === 'Run in Terminal') {
                await this.runInTerminal(project);
                return;
            } else if (answer === 'Install Debugger') {
                vscode.window.showInformationMessage(
                    'Install one of these extensions:\n' +
                    '• C# Dev Kit (VS Code)\n' +
                    '• free-vscode-csharp (VSCodium/Open-source)\n\n' +
                    'Note: free-vscode-csharp requires NetCoreDbg to be installed.',
                    'Open Extensions'
                ).then(choice => {
                    if (choice === 'Open Extensions') {
                        vscode.commands.executeCommand('workbench.extensions.search', '@category:"debuggers" csharp');
                    }
                });
                return;
            }
            return;
        }

        // Construct path to the output DLL
        const dllPath = path.join(
            project.projectDir,
            'bin',
            'Debug',
            project.targetFramework,
            `${project.name}.dll`
        );

        // Create debug configuration
        const config: vscode.DebugConfiguration = {
            name: `Debug ${project.name}`,
            type: 'coreclr',
            request: 'launch',
            program: dllPath,
            args: [],
            cwd: project.projectDir,
            stopAtEntry: false,
            console: 'internalConsole'
        };

        try {
            // Start debugging
            const success = await vscode.debug.startDebugging(undefined, config);

            if (!success) {
                throw new Error('Debug session failed to start');
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to start debugging ${project.name}. Try running in terminal instead?`,
                'Run in Terminal'
            ).then(choice => {
                if (choice === 'Run in Terminal') {
                    this.runInTerminal(project);
                }
            });
        }
    }

    /**
     * Fallback: Run project in terminal (like Watch feature)
     */
    private async runInTerminal(project: ProjectInfo): Promise<void> {
        const terminal = vscode.window.createTerminal({
            name: `Debug: ${project.name}`,
            cwd: project.projectDir
        });

        terminal.show();
        terminal.sendText(`dotnet run`);

        // Track terminal as active session
        const key = this.normalizePath(project.csprojPath);
        this.activeSessions.set(key, {
            sessionId: terminal.processId?.toString() || 'terminal',
            csprojPath: project.csprojPath,
            projectName: project.name
        });

        this._onDidChangeDebugSessions.fire();

        // Listen for terminal close
        const disposable = vscode.window.onDidCloseTerminal(closedTerminal => {
            if (closedTerminal === terminal) {
                this.activeSessions.delete(key);
                this._onDidChangeDebugSessions.fire();
                disposable.dispose();
            }
        });
    }

    /**
     * Start debugging all projects in a group
     */
    public async startGroup(group: DebugGroup, allProjects: ProjectInfo[]): Promise<void> {
        for (const projectName of group.projects) {
            const project = allProjects.find(p => p.name === projectName);

            if (project) {
                if (!this.isProjectDebugging(project.csprojPath)) {
                    await this.startDebugging(project);
                    // Small delay between launches to avoid overwhelming VS Code
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                vscode.window.showErrorMessage(`Project '${projectName}' not found in workspace`);
            }
        }
    }

    /**
     * Stop debugging a specific project
     */
    public async stopDebugging(csprojPath: string): Promise<void> {
        const key = this.normalizePath(csprojPath);
        const session = this.activeSessions.get(key);

        if (session) {
            // Find the actual debug session
            const activeSession = vscode.debug.activeDebugSession;
            if (activeSession && activeSession.id === session.sessionId) {
                await vscode.debug.stopDebugging(activeSession);
            }
        }
    }

    /**
     * Stop all projects in a debug group
     */
    public async stopGroup(group: DebugGroup, allProjects: ProjectInfo[]): Promise<void> {
        for (const projectName of group.projects) {
            const project = allProjects.find(p => p.name === projectName);
            if (project) {
                await this.stopDebugging(project.csprojPath);
            }
        }
    }

    /**
     * Check if a specific project is currently being debugged
     */
    public isProjectDebugging(csprojPath: string): boolean {
        return this.activeSessions.has(this.normalizePath(csprojPath));
    }

    /**
     * Check if all projects in a group are being debugged
     */
    public isGroupDebugging(group: DebugGroup, allProjects: ProjectInfo[]): boolean {
        if (group.projects.length === 0) return false;

        return group.projects.every(projectName => {
            const project = allProjects.find(p => p.name === projectName);
            return project && this.isProjectDebugging(project.csprojPath);
        });
    }

    /**
     * Get all active debug sessions
     */
    public getActiveSessions(): ActiveDebugSession[] {
        return Array.from(this.activeSessions.values());
    }

    private handleSessionStarted(session: vscode.DebugSession) {
        // Try to match session to a project by looking at the configuration
        const config = session.configuration;
        if (config && config.program) {
            // Extract project info from the program path
            // This is a best-effort approach
            const programPath = config.program as string;

            // Store session info
            // Note: We'll need to enhance this to properly map sessions to projects
            this._onDidChangeDebugSessions.fire();
        }
    }

    private handleSessionTerminated(session: vscode.DebugSession) {
        // Remove session from active sessions
        for (const [key, activeSession] of this.activeSessions.entries()) {
            if (activeSession.sessionId === session.id) {
                this.activeSessions.delete(key);
                this._onDidChangeDebugSessions.fire();
                break;
            }
        }
    }

    public dispose() {
        // Stop all active debug sessions
        if (vscode.debug.activeDebugSession) {
            vscode.debug.stopDebugging(vscode.debug.activeDebugSession);
        }
    }
}
