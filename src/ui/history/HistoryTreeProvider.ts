import * as vscode from 'vscode';
import { HistoryManager } from '../../services/HistoryManager';
import { DeploymentRecord, DeploymentRecordHelper } from '../../models/DeploymentRecord';

export class HistoryTreeProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

	constructor(private readonly historyManager: HistoryManager) { }

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: HistoryTreeItem): Promise<HistoryTreeItem[]> {
		if (!element) {
			// Root level - show date groups or empty message
			const history = this.historyManager.getAllHistory();

			if (history.length === 0) {
				return [
					new HistoryTreeItem(
						'No deployment history yet',
						vscode.TreeItemCollapsibleState.None,
						'empty'
					)
				];
			}

			// Group by date
			const groupByDate = vscode.workspace.getConfiguration('dotnetToolkit').get<boolean>('historyGroupByDate', true);

			if (groupByDate) {
				const groups = this.groupByDate(history);
				return Object.entries(groups).map(([groupName, records]) =>
					new HistoryTreeItem(
						`${groupName} (${records.length})`,
						vscode.TreeItemCollapsibleState.Expanded,
						'dateGroup',
						undefined,
						records
					)
				);
			} else {
				// Show all records directly
				return history.map(record => this.createDeploymentItem(record));
			}
		}

		if (element.contextValue === 'dateGroup' && element.records) {
			// Show deployments in this date group
			return element.records.map(record => this.createDeploymentItem(record));
		}

		if (element.contextValue === 'deployment' && element.record) {
			// Show deployment details
			return this.createDeploymentDetails(element.record);
		}

		return [];
	}

	private groupByDate(history: DeploymentRecord[]): Record<string, DeploymentRecord[]> {
		const groups: Record<string, DeploymentRecord[]> = {
			'Today': [],
			'Yesterday': [],
			'This Week': [],
			'Older': []
		};

		for (const record of history) {
			const group = DeploymentRecordHelper.getDateGroup(record.startTime);
			groups[group].push(record);
		}

		// Remove empty groups
		return Object.fromEntries(
			Object.entries(groups).filter(([_, records]) => records.length > 0)
		);
	}

	private createDeploymentItem(record: DeploymentRecord): HistoryTreeItem {
		const statusIcon = this.getStatusIcon(record.status);
		const durationText = record.duration ? ` (${DeploymentRecordHelper.formatDuration(record.duration)})` : '';
		const label = `${statusIcon} ${record.profileName}${durationText}`;

		return new HistoryTreeItem(
			label,
			vscode.TreeItemCollapsibleState.Collapsed,
			'deployment',
			record
		);
	}

	private createDeploymentDetails(record: DeploymentRecord): HistoryTreeItem[] {
		const details: HistoryTreeItem[] = [];

		// Project name
		details.push(new HistoryTreeItem(
			`Project: ${record.projectName}`,
			vscode.TreeItemCollapsibleState.None,
			'detail'
		));

		// Environment
		details.push(new HistoryTreeItem(
			`Environment: ${record.environment}`,
			vscode.TreeItemCollapsibleState.None,
			'detail'
		));

		// Start time
		const startTime = new Date(record.startTime).toLocaleString();
		details.push(new HistoryTreeItem(
			`Started: ${startTime}`,
			vscode.TreeItemCollapsibleState.None,
			'detail'
		));

		// End time
		if (record.endTime) {
			const endTime = new Date(record.endTime).toLocaleString();
			details.push(new HistoryTreeItem(
				`Completed: ${endTime}`,
				vscode.TreeItemCollapsibleState.None,
				'detail'
			));
		}

		// Duration
		if (record.duration) {
			details.push(new HistoryTreeItem(
				`Duration: ${DeploymentRecordHelper.formatDuration(record.duration)}`,
				vscode.TreeItemCollapsibleState.None,
				'detail'
			));
		}

		// Error message if failed
		if (record.status === 'failed' && record.errorMessage) {
			details.push(new HistoryTreeItem(
				`Error: ${record.errorMessage}`,
				vscode.TreeItemCollapsibleState.None,
				'error'
			));
		}

		return details;
	}

	private getStatusIcon(status: string): string {
		switch (status) {
			case 'success': return '✅';
			case 'failed': return '❌';
			case 'in-progress': return '⏳';
			default: return '❓';
		}
	}
}

export class HistoryTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly record?: DeploymentRecord,
		public readonly records?: DeploymentRecord[]
	) {
		super(label, collapsibleState);
		this.setupItem();
	}

	private setupItem() {
		switch (this.contextValue) {
			case 'dateGroup':
				this.iconPath = new vscode.ThemeIcon('calendar');
				break;
			case 'deployment':
				if (this.record) {
					this.iconPath = this.getStatusThemeIcon(this.record.status);
					this.tooltip = this.createTooltip();
					this.description = DeploymentRecordHelper.formatTimestamp(this.record.startTime);
				}
				break;
			case 'detail':
				this.iconPath = new vscode.ThemeIcon('info');
				break;
			case 'error':
				this.iconPath = new vscode.ThemeIcon('error');
				break;
			case 'empty':
				this.iconPath = new vscode.ThemeIcon('inbox');
				break;
		}
	}

	private getStatusThemeIcon(status: string): vscode.ThemeIcon {
		switch (status) {
			case 'success':
				return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
			case 'failed':
				return new vscode.ThemeIcon('error', new vscode.ThemeColor('testing.iconFailed'));
			case 'in-progress':
				return new vscode.ThemeIcon('sync~spin', new vscode.ThemeColor('testing.iconQueued'));
			default:
				return new vscode.ThemeIcon('question');
		}
	}

	private createTooltip(): string {
		if (!this.record) return '';

		const lines = [
			`Profile: ${this.record.profileName}`,
			`Project: ${this.record.projectName}`,
			`Environment: ${this.record.environment}`,
			`Status: ${this.record.status}`,
			`Started: ${new Date(this.record.startTime).toLocaleString()}`
		];

		if (this.record.endTime) {
			lines.push(`Completed: ${new Date(this.record.endTime).toLocaleString()}`);
		}

		if (this.record.duration) {
			lines.push(`Duration: ${DeploymentRecordHelper.formatDuration(this.record.duration)}`);
		}

		if (this.record.errorMessage) {
			lines.push(`Error: ${this.record.errorMessage}`);
		}

		return lines.join('\n');
	}
}
