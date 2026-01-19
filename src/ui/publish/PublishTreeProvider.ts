import * as vscode from 'vscode';
import { ProjectScanner } from '../../utils/ProjectScanner';
import { ProjectInfo, PublishProfileInfo, DeployEnvironment } from '../../models/ProjectModels';

export class PublishTreeProvider implements vscode.TreeDataProvider<PublishTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PublishTreeItem | undefined | null | void> =
		new vscode.EventEmitter<PublishTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PublishTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	private scanner: ProjectScanner;

	constructor(private workspaceRoot: string | undefined) {
		this.scanner = new ProjectScanner();
	}

	refresh(): void {
		this.scanner.clearCache();
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PublishTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: PublishTreeItem): Promise<PublishTreeItem[]> {
		if (!this.workspaceRoot) {
			return [
				new PublishTreeItem(
					'No workspace folder open',
					vscode.TreeItemCollapsibleState.None,
					'placeholder'
				),
			];
		}

		if (!element) {
			// Root level - scan workspace
			const workspace = await this.scanner.scanWorkspace(this.workspaceRoot);

			if (workspace.projects.length === 0) {
				return [
					new PublishTreeItem(
						'No .NET projects found',
						vscode.TreeItemCollapsibleState.None,
						'placeholder',
						undefined,
						'Open a workspace with .csproj files to see projects'
					),
				];
			}

			// Group by project type or show flat list
			const apiProjects = workspace.projects.filter((p) => p.projectType === 'api');
			const webProjects = workspace.projects.filter((p) => p.projectType === 'web');
			const otherProjects = workspace.projects.filter(
				(p) =>
					p.projectType !== 'api' &&
					p.projectType !== 'web' &&
					p.projectType !== 'library'
			);

			const items: PublishTreeItem[] = [];

			// Show publishable projects (API & Web)
			for (const project of [...apiProjects, ...webProjects, ...otherProjects]) {
				const hasProfiles = project.profiles.length > 0;
				items.push(
					new PublishTreeItem(
						project.name,
						hasProfiles
							? vscode.TreeItemCollapsibleState.Collapsed
							: vscode.TreeItemCollapsibleState.None,
						'project',
						project
					)
				);
			}

			return items;
		}

		if (element.contextValue === 'project' && element.projectInfo) {
			// Project level - show profiles or placeholder
			const project = element.projectInfo;

			if (project.profiles.length === 0) {
				return [
					new PublishTreeItem(
						'No publish profiles found',
						vscode.TreeItemCollapsibleState.None,
						'placeholder',
						undefined,
						'Create profiles in Visual Studio or add .pubxml files to Properties/PublishProfiles/'
					),
				];
			}

			// Show publish profiles
			console.log('[PublishTreeProvider] Creating profile items for project:', project.name);
			console.log('[PublishTreeProvider] Project csprojPath:', project.csprojPath);
			console.log('[PublishTreeProvider] Number of profiles:', project.profiles.length);

			return project.profiles.map((profile) => {
				const item = new PublishTreeItem(
					profile.name,
					vscode.TreeItemCollapsibleState.None,
					'publishProfile',
					project, // Pass project info for deployment
					undefined,
					profile,
					project.name // Pass project name for password var naming
				);
				console.log(
					'[PublishTreeProvider] Created item for profile:',
					profile.name,
					'has projectInfo:',
					!!item.projectInfo
				);
				return item;
			});
		}

		return [];
	}
}

export class PublishTreeItem extends vscode.TreeItem {
	public readonly projectInfo?: ProjectInfo;
	public readonly profileInfo?: PublishProfileInfo;
	public readonly projectName?: string;
	public readonly csprojPath?: string; // Store directly for serialization

	/** Get the .csproj path for deployment */
	get projectPath(): string | undefined {
		// Prefer direct csprojPath (survives serialization)
		return this.csprojPath || this.projectInfo?.csprojPath;
	}

	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		projectInfo?: ProjectInfo,
		description?: string,
		profileInfo?: PublishProfileInfo,
		projectName?: string
	) {
		super(label, collapsibleState);

		// Debug logging
		if (contextValue === 'publishProfile') {
			console.log('[PublishTreeItem.constructor] Creating profile item:', label);
			console.log('[PublishTreeItem.constructor] Received projectInfo:', !!projectInfo);
			console.log(
				'[PublishTreeItem.constructor] projectInfo.csprojPath:',
				projectInfo?.csprojPath
			);
		}

		this.projectInfo = projectInfo;
		this.profileInfo = profileInfo;
		this.projectName = projectName;

		// CRITICAL: Store csprojPath directly to survive VS Code serialization
		// VS Code may serialize/deserialize tree items, losing complex objects
		this.csprojPath = projectInfo?.csprojPath;

		// Verify assignment
		if (contextValue === 'publishProfile') {
			console.log(
				'[PublishTreeItem.constructor] After assignment - this.projectInfo:',
				!!this.projectInfo
			);
			console.log(
				'[PublishTreeItem.constructor] After assignment - this.csprojPath:',
				this.csprojPath
			);
			console.log(
				'[PublishTreeItem.constructor] After assignment - this.projectPath:',
				this.projectPath
			);
		}

		if (description) {
			this.description = description;
		}
		this.setupItem();
	}

	private setupItem() {
		// Set icons based on type
		switch (this.contextValue) {
			case 'project':
				if (this.projectInfo) {
					switch (this.projectInfo.projectType) {
						case 'api':
							this.iconPath = new vscode.ThemeIcon('circuit-board');
							break;
						case 'web':
							this.iconPath = new vscode.ThemeIcon('browser');
							break;
						case 'library':
							this.iconPath = new vscode.ThemeIcon('library');
							break;
						default:
							this.iconPath = new vscode.ThemeIcon('file-code');
					}

					// Show profile count in description
					const profileCount = this.projectInfo.profiles.length;
					if (profileCount > 0) {
						this.description = `${profileCount} profile${profileCount > 1 ? 's' : ''}`;
					}
				}
				break;
			case 'publishProfile':
				if (this.profileInfo) {
					// Environment-specific colored icons
					const env = this.profileInfo.environment;
					if (env === DeployEnvironment.Production) {
						this.iconPath = new vscode.ThemeIcon(
							'warning',
							new vscode.ThemeColor('errorForeground')
						);
						this.description = 'PRODUCTION';
					} else if (env === DeployEnvironment.Staging) {
						this.iconPath = new vscode.ThemeIcon(
							'beaker',
							new vscode.ThemeColor('charts.blue')
						);
						this.description = 'STAGING';
					} else if (env === DeployEnvironment.Development) {
						this.iconPath = new vscode.ThemeIcon(
							'code',
							new vscode.ThemeColor('charts.green')
						);
						this.description = 'DEV';
					} else {
						this.iconPath = new vscode.ThemeIcon('circle-outline');
					}

					// Click to open profile info panel
					this.command = {
						command: 'dotnet-project-toolkit.profileInfo',
						title: 'Show Profile Info',
						arguments: [this],
					};
				}
				break;
			case 'placeholder':
				this.iconPath = new vscode.ThemeIcon('info');
				break;
		}
	}
}
