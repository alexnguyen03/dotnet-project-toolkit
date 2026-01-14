import * as vscode from 'vscode';

export class PublishTreeProvider implements vscode.TreeDataProvider<PublishTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PublishTreeItem | undefined | null | void> = new vscode.EventEmitter<PublishTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PublishTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private workspaceRoot: string | undefined) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PublishTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: PublishTreeItem): Promise<PublishTreeItem[]> {
		if (!this.workspaceRoot) {
			vscode.window.showInformationMessage('No workspace folder open');
			return [];
		}

		if (!element) {
			// Root level - show folder structure
			return [
				new PublishTreeItem(
					'Server',
					vscode.TreeItemCollapsibleState.Expanded,
					'folder'
				),
				new PublishTreeItem(
					'Client',
					vscode.TreeItemCollapsibleState.Collapsed,
					'folder'
				)
			];
		}

		if (element.contextValue === 'folder') {
			// Folder level - show projects (mock data for now)
			if (element.label === 'Server') {
				return [
					new PublishTreeItem(
						'BudgetControl.Server.Api',
						vscode.TreeItemCollapsibleState.Collapsed,
						'project'
					),
					new PublishTreeItem(
						'BudgetControl.Server.Web',
						vscode.TreeItemCollapsibleState.Collapsed,
						'project'
					),
					new PublishTreeItem(
						'Shared',
						vscode.TreeItemCollapsibleState.None,
						'library'
					)
				];
			} else {
				return [
					new PublishTreeItem(
						'BudgetControl.Client.Core',
						vscode.TreeItemCollapsibleState.Collapsed,
						'project'
					)
				];
			}
		}

		if (element.contextValue === 'project') {
			// Project level - show "Profiles" folder
			return [
				new PublishTreeItem(
					'Profiles',
					vscode.TreeItemCollapsibleState.Expanded,
					'profileFolder'
				)
			];
		}

		if (element.contextValue === 'profileFolder') {
			// Profiles folder - show actual profiles (mock data)
			const parentProject = element.label as string;
			const profiles: PublishTreeItem[] = [];
			
			if (parentProject.includes('Api')) {
				profiles.push(
					new PublishTreeItem(
						'uat-api [UAT]',
						vscode.TreeItemCollapsibleState.None,
						'publishProfile'
					)
				);
				profiles.push(
					new PublishTreeItem(
						'prod-api [PROD]',
						vscode.TreeItemCollapsibleState.None,
						'publishProfile',
						true // isProd
					)
				);
			} else if (parentProject.includes('Web')) {
				profiles.push(
					new PublishTreeItem(
						'uat-web [UAT]',
						vscode.TreeItemCollapsibleState.None,
						'publishProfile'
					)
				);
				profiles.push(
					new PublishTreeItem(
						'prod-web [PROD]',
						vscode.TreeItemCollapsibleState.None,
						'publishProfile',
						true
					)
				);
			}
			
			return profiles;
		}

		return [];
	}
}

export class PublishTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly isProd: boolean = false
	) {
		super(label, collapsibleState);
		this.tooltip = this.label;
		this.setupItem();
	}

	private setupItem() {
		// Set icons based on type
		switch (this.contextValue) {
			case 'folder':
				this.iconPath = new vscode.ThemeIcon('folder');
				break;
			case 'project':
				this.iconPath = new vscode.ThemeIcon('globe');
				break;
			case 'library':
				this.iconPath = new vscode.ThemeIcon('library');
				break;
			case 'profileFolder':
				this.iconPath = new vscode.ThemeIcon('folder-opened');
				break;
			case 'publishProfile':
				this.iconPath = this.isProd 
					? new vscode.ThemeIcon('warning', new vscode.ThemeColor('errorForeground'))
					: new vscode.ThemeIcon('file-code');
				
				// Add inline deploy button
				this.command = {
					command: 'dotnet-project-toolkit.deployProfile',
					title: 'Deploy',
					arguments: [this]
				};
				break;
		}
	}
}
