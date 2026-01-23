import * as vscode from 'vscode';
import { RunService } from '../services/RunService';
import { WatchConfigService } from '../services/WatchConfigService';
import { DebugConfigService } from '../services/DebugConfigService';
import { ProjectScanner } from '../utils/ProjectScanner';
import { ProjectInfo } from '../models/ProjectModels';
import { WatchGroup } from '../models/WatchModels';
import { DebugGroup } from '../models/DebugModels';

export type RunTreeItem =
	| RunProjectItem
	| WatchGroupItem
	| DebugGroupItem
	| GroupContainerItem
	| ProjectContainerItem
	| InfoItem
	| DebugWarningItem;

export class RunTreeProvider implements vscode.TreeDataProvider<RunTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<RunTreeItem | undefined | null | void> =
		new vscode.EventEmitter<RunTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<RunTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	constructor(
		private readonly runService: RunService,
		private readonly watchConfigService: WatchConfigService,
		private readonly debugConfigService: DebugConfigService,
		private readonly projectScanner: ProjectScanner,
		private readonly workspaceRoot: string,
		private readonly hasDebugger: boolean
	) {
		// Subscribe to state changes
		this.runService.onDidChangeState(() => this.refresh());
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: RunTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: RunTreeItem): Promise<RunTreeItem[]> {
		if (!element) {
			// Root level
			const items: RunTreeItem[] = [];

			// Show debugger warning if not available
			if (!this.hasDebugger) {
				items.push(new DebugWarningItem('⚠️ No C# Debugger Detected'));
			}

			// Add group containers
			items.push(
				new GroupContainerItem('Watch Groups', 'watch-groups', 'watchGroupsContainer')
			);
			items.push(
				new GroupContainerItem('Debug Groups', 'debug-groups', 'debugGroupsContainer')
			);

			// Add projects container
			items.push(new ProjectContainerItem('All Projects', 'all-projects'));

			return items;
		}

		// Watch Groups Container
		if (element instanceof GroupContainerItem && element.id === 'watch-groups') {
			const groups = this.watchConfigService.getGroups();
			if (groups.length === 0) {
				return [new InfoItem('No watch groups created')];
			}
			const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
			return groups.map((g) => new WatchGroupItem(g, structure.projects, this.runService));
		}

		// Debug Groups Container
		if (element instanceof GroupContainerItem && element.id === 'debug-groups') {
			const groups = this.debugConfigService.getGroups();
			if (groups.length === 0) {
				return [new InfoItem('No debug groups created')];
			}
			const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
			return groups.map((g) => new DebugGroupItem(g, structure.projects, this.runService));
		}

		// All Projects Container
		if (element instanceof ProjectContainerItem) {
			const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
			const sortedProjects = [...structure.projects].sort((a, b) =>
				a.name.localeCompare(b.name)
			);
			return sortedProjects.map((p) => new RunProjectItem(p, this.runService));
		}

		// Debug Warning children
		if (element instanceof DebugWarningItem) {
			return [
				new InfoItem('Install a C# debugger extension:'),
				new InfoItem('• C# Dev Kit (VS Code)'),
				new InfoItem('• free-vscode-csharp (VSCodium)'),
			];
		}

		return [];
	}
}

export class GroupContainerItem extends vscode.TreeItem {
	constructor(
		label: string,
		public readonly id: string,
		contextValue: string
	) {
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = contextValue;
	}
}

export class ProjectContainerItem extends vscode.TreeItem {
	constructor(
		label: string,
		public readonly id: string
	) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = 'projectContainer';
	}
}

export class RunProjectItem extends vscode.TreeItem {
	constructor(
		public readonly project: ProjectInfo,
		private readonly runService: RunService
	) {
		super(project.name, vscode.TreeItemCollapsibleState.None);

		const state = this.runService.getProjectState(project.csprojPath);

		// Set context value based on state
		if (state === 'watching') {
			this.contextValue = 'runProjectWatching';
			this.iconPath = new vscode.ThemeIcon('sync~spin');
			this.description = `${vscode.workspace.asRelativePath(project.projectDir)} • Watching`;
		} else if (state === 'debugging') {
			this.contextValue = 'runProjectDebugging';
			this.iconPath = new vscode.ThemeIcon('debug-start');
			this.description = `${vscode.workspace.asRelativePath(project.projectDir)} • Debugging`;
		} else {
			this.contextValue = 'runProject';
			this.iconPath = new vscode.ThemeIcon('code');
			this.description = vscode.workspace.asRelativePath(project.projectDir);
		}

		if (!project.targetFramework) {
			this.description += ' (no target framework)';
			this.tooltip = 'TargetFramework not found in .csproj - debugging may fail';
		}
	}
}

export class WatchGroupItem extends vscode.TreeItem {
	constructor(
		public readonly group: WatchGroup,
		private readonly allProjects: ProjectInfo[],
		private readonly runService: RunService
	) {
		super(group.name, vscode.TreeItemCollapsibleState.None);
		this.description = `(${group.projects.length} projects)`;

		// Check if all projects in group are watching
		const isRunning = group.projects.every((projectName) => {
			const project = allProjects.find((p) => p.name === projectName);
			return project && runService.getProjectState(project.csprojPath) === 'watching';
		});

		this.contextValue = isRunning ? 'watchGroupRunning' : 'watchGroup';
		this.iconPath = new vscode.ThemeIcon('layers');
		this.tooltip = group.projects.join('\n');
	}
}

export class DebugGroupItem extends vscode.TreeItem {
	constructor(
		public readonly group: DebugGroup,
		private readonly allProjects: ProjectInfo[],
		private readonly runService: RunService
	) {
		super(group.name, vscode.TreeItemCollapsibleState.None);
		this.description = `(${group.projects.length} projects)`;

		// Check if all projects in group are debugging
		const isRunning = group.projects.every((projectName) => {
			const project = allProjects.find((p) => p.name === projectName);
			return project && runService.getProjectState(project.csprojPath) === 'debugging';
		});

		this.contextValue = isRunning ? 'debugGroupRunning' : 'debugGroup';
		this.iconPath = new vscode.ThemeIcon('layers');
		this.tooltip = group.projects.join('\n');
	}
}

export class InfoItem extends vscode.TreeItem {
	constructor(label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'info';
		this.id = 'info-' + Math.random();
	}
}

export class DebugWarningItem extends vscode.TreeItem {
	constructor(label: string) {
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = 'debugWarning';
		this.iconPath = new vscode.ThemeIcon(
			'warning',
			new vscode.ThemeColor('problemsWarningIcon.foreground')
		);
		this.description = 'Click to see options';
		this.tooltip = 'No C# debugger extension detected. Projects will run in terminal mode.';
	}
}
