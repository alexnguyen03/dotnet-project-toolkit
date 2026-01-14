import * as vscode from 'vscode';

export class DebugTreeProvider implements vscode.TreeDataProvider<DebugTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<DebugTreeItem | undefined | null | void> = new vscode.EventEmitter<DebugTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<DebugTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: DebugTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: DebugTreeItem): Promise<DebugTreeItem[]> {
		if (!element) {
			return [
				new DebugTreeItem(
					'🐛 Debug Feature',
					vscode.TreeItemCollapsibleState.Expanded,
					'info'
				)
			];
		}

		if (element.contextValue === 'info') {
			return [
				new DebugTreeItem(
					'Coming in v1.1',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new DebugTreeItem(
					'',
					vscode.TreeItemCollapsibleState.None,
					'empty'
				),
				new DebugTreeItem(
					'This view will allow you to:',
					vscode.TreeItemCollapsibleState.None,
					'message'
				),
				new DebugTreeItem(
					'• Manage debug configurations',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new DebugTreeItem(
					'• Launch multiple debug sessions',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
				new DebugTreeItem(
					'• Quick-switch debug profiles',
					vscode.TreeItemCollapsibleState.None,
					'feature'
				),
			];
		}

		return [];
	}
}

export class DebugTreeItem extends vscode.TreeItem {
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
