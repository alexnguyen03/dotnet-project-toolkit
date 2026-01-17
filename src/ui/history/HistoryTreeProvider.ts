import * as vscode from 'vscode';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: HistoryTreeItem): Promise<HistoryTreeItem[]> {
		if (!element) {
			return [
				new HistoryTreeItem(
					'📜 History Feature',
					vscode.TreeItemCollapsibleState.Expanded,
					'info'
				)
			];
		}

		if (element.contextValue === 'info') {
			return [
				new HistoryTreeItem(
					'Coming in v1.2',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new HistoryTreeItem(
					'',
					vscode.TreeItemCollapsibleState.None,
					'empty'
				),
				new HistoryTreeItem(
					'This view will allow you to:',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new HistoryTreeItem(
					'• View deployment history',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new HistoryTreeItem(
					'• Track deployment timeline',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new HistoryTreeItem(
					'• Rollback deployments',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
			];
		}

		return [];
	}
}

export class HistoryTreeItem extends vscode.TreeItem {
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
		}
	}
}
