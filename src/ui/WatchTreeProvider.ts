import * as vscode from 'vscode';
import * as path from 'path';
import { WatchService } from '../services/WatchService';
import { WatchConfigService } from '../services/WatchConfigService';
import { ProjectScanner } from '../utils/ProjectScanner';
import { ProjectInfo } from '../models/ProjectModels';
import { WatchGroup } from '../models/WatchModels';

export type WatchTreeItem = RunningWatchItem | WatchGroupItem | ProjectItem | GroupContainerItem | ProjectContainerItem | InfoItem;

export class WatchTreeProvider implements vscode.TreeDataProvider<WatchTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<WatchTreeItem | undefined | null | void> = new vscode.EventEmitter<WatchTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<WatchTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(
        private readonly watchService: WatchService,
        private readonly configService: WatchConfigService,
        private readonly projectScanner: ProjectScanner,
        private readonly workspaceRoot: string
    ) {
        vscode.window.onDidCloseTerminal(() => this.refresh());
        vscode.window.onDidOpenTerminal(() => this.refresh());
        this.watchService.onDidChangeRunningWatches(() => this.refresh());
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: WatchTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: WatchTreeItem): Promise<WatchTreeItem[]> {
        if (!element) {
            return [
                new GroupContainerItem('Watch Groups', 'watch-groups', 'watchGroupsContainer'),
                new ProjectContainerItem('All Projects', 'watch-projects')
            ];
        }

        if (element instanceof GroupContainerItem) {
            if (element.id === 'watch-groups') {
                const groups = this.configService.getGroups();
                if (groups.length === 0) {
                    return [new InfoItem('No watch groups created')];
                }
                // Need scanning to check running status against all projects? 
                // Actually WatchService.isGroupRunning needs allProjects ONLY to look up CSPROJ path from name.
                // If I can make isGroupRunning work with just names? 
                // WatchService uses runningWatches Map<string, RunningWatch>. Key is csprojPath.
                // Group stores names.
                // So I definitely need project structure to map Name -> Path.
                const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
                return groups.map(g => new WatchGroupItem(g, this.watchService.isGroupRunning(g, structure.projects)));
            }
        }

        if (element instanceof ProjectContainerItem) {
            const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
            const sortedProjects = [...structure.projects].sort((a, b) => a.name.localeCompare(b.name));
            return sortedProjects.map(p => new ProjectItem(p, this.watchService.isProjectRunning(p.csprojPath)));
        }

        return [];
    }
}

export class GroupContainerItem extends vscode.TreeItem {
    constructor(label: string, public readonly id: string, contextValue: string) {
        super(label, vscode.TreeItemCollapsibleState.Expanded);
        this.contextValue = contextValue;
    }
}

export class ProjectContainerItem extends vscode.TreeItem {
    constructor(label: string, public readonly id: string) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.contextValue = 'projectContainer';
    }
}

export class RunningWatchItem extends vscode.TreeItem {
    constructor(public readonly projectName: string, public readonly csprojPath: string) {
        super(projectName, vscode.TreeItemCollapsibleState.None);
        this.description = 'Running...';
        this.contextValue = 'runningWatch';
        this.iconPath = new vscode.ThemeIcon('pulse');
    }
}

export class WatchGroupItem extends vscode.TreeItem {
    constructor(public readonly group: WatchGroup, isRunning: boolean) {
        super(group.name, vscode.TreeItemCollapsibleState.None);
        this.description = `(${group.projects.length} projects)`;
        this.contextValue = isRunning ? 'watchGroupRunning' : 'watchGroup';
        this.iconPath = new vscode.ThemeIcon(isRunning ? 'debug-pause' : 'layers'); // Visual cue (pause icon for running group?) User asked for 'play btn thành pause btn' on action, but item icon? 'layers' is fine.
        // User said: "play btn thành pause btn" - this refers to the ACTION button.
        // But changing the tree item icon to indicate running state is also good.
        // Let's keep 'layers' for consistency or use 'debug-start'/'debug-pause'? 
        // User request: "play btn thành pause btn" usually implies the inline action. I will handle that in package.json.
        // For the ITEM icon, I'll stick to 'layers' to distinguish from single items, or maybe change color?
        // Let's just keep 'layers' for now + the contextValue change.
        this.iconPath = new vscode.ThemeIcon('layers');
        this.tooltip = group.projects.join('\n');
    }
}

export class ProjectItem extends vscode.TreeItem {
    constructor(public readonly project: ProjectInfo, isRunning: boolean) {
        super(project.name, vscode.TreeItemCollapsibleState.None);
        this.contextValue = isRunning ? 'watchProjectRunning' : 'watchProject';
        this.iconPath = isRunning ? new vscode.ThemeIcon('sync~spin') : new vscode.ThemeIcon('code');
        this.description = vscode.workspace.asRelativePath(project.projectDir);
    }
}

export class InfoItem extends vscode.TreeItem {
    constructor(label: string) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'info';
        this.id = 'info-' + Math.random();
    }
}
