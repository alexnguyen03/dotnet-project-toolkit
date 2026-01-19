import * as vscode from 'vscode';
import { DebugService } from '../../services/DebugService';
import { DebugConfigService } from '../../services/DebugConfigService';
import { ProjectScanner } from '../../utils/ProjectScanner';
import { ProjectInfo } from '../../models/ProjectModels';
import { DebugGroup } from '../../models/DebugModels';

export type DebugTreeItem =
	| DebugGroupItem
	| DebugProjectItem
	| GroupContainerItem
	| ProjectContainerItem
	| InfoItem
	| DebugWarningItem;

export class DebugTreeProvider implements vscode.TreeDataProvider<DebugTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<DebugTreeItem | undefined | null | void> =
		new vscode.EventEmitter<DebugTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<DebugTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	constructor(
		private readonly debugService: DebugService,
		private readonly configService: DebugConfigService,
		private readonly projectScanner: ProjectScanner,
		private readonly workspaceRoot: string
	) {
		// Subscribe to debug session changes
		this.debugService.onDidChangeDebugSessions(() => this.refresh());
	}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: DebugTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: DebugTreeItem): Promise<DebugTreeItem[]> {
		if (!element) {
			// Check if debugger is available and show warning
			if (!this.debugService.hasDebugger) {
				return [
					new DebugWarningItem('⚠️ No C# Debugger Detected'),
					new GroupContainerItem('Debug Groups', 'debug-groups', 'debugGroupsContainer'),
					new ProjectContainerItem(
						'All Projects',
						'debug-projects',
						this.debugService.hasActiveSessions
					),
				];
			}

			return [
				new GroupContainerItem('Debug Groups', 'debug-groups', 'debugGroupsContainer'),
				new ProjectContainerItem(
					'All Projects',
					'debug-projects',
					this.debugService.hasActiveSessions
				),
			];
		}

		if (element instanceof GroupContainerItem) {
			if (element.id === 'debug-groups') {
				const groups = this.configService.getGroups();
				if (groups.length === 0) {
					return [new InfoItem('No debug groups created')];
				}
				const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
				return groups.map(
					(g) =>
						new DebugGroupItem(
							g,
							this.debugService.isGroupDebugging(g, structure.projects)
						)
				);
			}
		}

		if (element instanceof ProjectContainerItem) {
			const structure = await this.projectScanner.scanWorkspace(this.workspaceRoot);
			const sortedProjects = [...structure.projects].sort((a, b) =>
				a.name.localeCompare(b.name)
			);
			return sortedProjects.map(
				(p) => new DebugProjectItem(p, this.debugService.isProjectDebugging(p.csprojPath))
			);
		}

		// Handle DebugWarningItem children
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
		super(label, vscode.TreeItemCollapsibleState.Expanded);
		this.contextValue = contextValue;
	}
}

export class ProjectContainerItem extends vscode.TreeItem {
	constructor(
		label: string,
		public readonly id: string,
		hasActiveSessions: boolean
	) {
		super(label, vscode.TreeItemCollapsibleState.Collapsed);
		this.contextValue = hasActiveSessions
			? 'debugProjectsContainerRunning'
			: 'projectContainer';
	}
}

export class DebugGroupItem extends vscode.TreeItem {
	constructor(
		public readonly group: DebugGroup,
		isDebugging: boolean
	) {
		super(group.name, vscode.TreeItemCollapsibleState.None);
		this.description = `(${group.projects.length} projects)`;
		this.contextValue = isDebugging ? 'debugGroupRunning' : 'debugGroup';
		this.iconPath = new vscode.ThemeIcon('layers');
		this.tooltip = group.projects.join('\n');
	}
}

export class DebugProjectItem extends vscode.TreeItem {
	constructor(
		public readonly project: ProjectInfo,
		isDebugging: boolean
	) {
		super(project.name, vscode.TreeItemCollapsibleState.None);
		this.contextValue = isDebugging ? 'debugProjectRunning' : 'debugProject';
		this.iconPath = isDebugging
			? new vscode.ThemeIcon('debug-start')
			: new vscode.ThemeIcon('bug');
		this.description = vscode.workspace.asRelativePath(project.projectDir);

		if (!project.targetFramework) {
			this.description += ' (no target framework)';
			this.tooltip = 'TargetFramework not found in .csproj - debugging may fail';
		}
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
