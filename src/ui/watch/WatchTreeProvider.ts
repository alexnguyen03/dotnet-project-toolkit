import * as vscode from 'vscode';

export class WatchTreeProvider implements vscode.TreeDataProvider<WatchTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<WatchTreeItem | undefined | null | void> =
		new vscode.EventEmitter<WatchTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<WatchTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: WatchTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: WatchTreeItem): Promise<WatchTreeItem[]> {
		if (!element) {
			// Root level - show coming soon message
			return [
				new WatchTreeItem(
					'⚡ Watch Feature',
					vscode.TreeItemCollapsibleState.Expanded,
					'info'
				),
			];
		}

		if (element.contextValue === 'info') {
			return [
				new WatchTreeItem(
					'Coming in v1.1',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new WatchTreeItem('', vscode.TreeItemCollapsibleState.None, 'empty'),
				new WatchTreeItem(
					'This view will allow you to:',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new WatchTreeItem(
					'• Run multiple watch instances',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new WatchTreeItem(
					'• Hot-reload your applications',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new WatchTreeItem(
					'• Attach debugger while watching',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
			];
		}

		return [];
	}
}

export class WatchTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string
	) {
		super(label, collapsibleState);
		this.setupItem();
	}

	private setupItem() {
		switch (this.contextValue) {
			case 'info':
				this.iconPath = new vscode.ThemeIcon('info');
				break;
			case 'feature':
				this.iconPath = new vscode.ThemeIcon('check');
				this.description = '(coming soon)';
				break;
			case 'message':
				this.iconPath = new vscode.ThemeIcon('comment');
				break;
			case 'empty':
				// No icon for spacing
				break;
		}
	}
}
