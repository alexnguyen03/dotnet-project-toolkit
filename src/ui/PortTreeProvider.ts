import * as vscode from 'vscode';
import { PortService, ActivePort } from '../services/PortService';

export type PortTreeItem = PortItem | InfoItem;

export class PortTreeProvider implements vscode.TreeDataProvider<PortTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<PortTreeItem | undefined | null | void> =
		new vscode.EventEmitter<PortTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<PortTreeItem | undefined | null | void> =
		this._onDidChangeTreeData.event;

	constructor(private readonly portService: PortService) {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	getTreeItem(element: PortTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: PortTreeItem): Promise<PortTreeItem[]> {
		if (element) {
			return [];
		}

		try {
			const activePorts = await this.portService.getActivePorts();
			if (activePorts.length === 0) {
				return [new InfoItem('No active local ports found')];
			}
			return activePorts.map((ap) => new PortItem(ap));
		} catch (error: any) {
			return [new InfoItem(`Error: ${error.message}`)];
		}
	}
}

export class PortItem extends vscode.TreeItem {
	constructor(public readonly activePort: ActivePort) {
		super(`Port: ${activePort.port} (${activePort.processName})`, vscode.TreeItemCollapsibleState.None);
		this.description = `PID: ${activePort.pid}`;
		this.contextValue = 'activePort';
		this.iconPath = new vscode.ThemeIcon('plug');
		this.tooltip = `Process: ${activePort.processName}\nPID: ${activePort.pid}\nPort: ${activePort.port}\nProtocol: ${activePort.protocol}\nAddress: ${activePort.address}`;
	}
}

export class InfoItem extends vscode.TreeItem {
	constructor(label: string) {
		super(label, vscode.TreeItemCollapsibleState.None);
		this.contextValue = 'info';
	}
}
