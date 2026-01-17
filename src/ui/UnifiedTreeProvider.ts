import * as vscode from 'vscode';
import { PublishTreeProvider, PublishTreeItem } from './publish/PublishTreeProvider';
import { WatchTreeProvider, WatchTreeItem } from './WatchTreeProvider';
import {
    GroupContainerItem,
    ProjectContainerItem,
    RunningWatchItem,
    WatchGroupItem,
    ProjectItem,
    InfoItem
} from './WatchTreeProvider';
import { DebugTreeProvider } from './debug/DebugTreeProvider';
import {
    DebugTreeItem,
    DebugGroupItem,
    DebugProjectItem,
    GroupContainerItem as DebugGroupContainerItem,
    ProjectContainerItem as DebugProjectContainerItem,
    InfoItem as DebugInfoItem,
    DebugWarningItem
} from './debug/DebugTreeProvider';
import { HistoryTreeProvider, HistoryTreeItem } from './history/HistoryTreeProvider';
import { HistoryManager } from '../services/HistoryManager';

export class UnifiedTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    // Child providers
    private publishProvider: PublishTreeProvider;
    private watchProvider: WatchTreeProvider;
    private debugProvider: DebugTreeProvider;
    private historyProvider: HistoryTreeProvider;

    constructor(
        workspaceRoot: string | undefined,
        historyManager: HistoryManager,
        watchTreeProvider: WatchTreeProvider,
        debugTreeProvider: DebugTreeProvider
    ) {
        this.publishProvider = new PublishTreeProvider(workspaceRoot);
        this.watchProvider = watchTreeProvider;
        this.debugProvider = debugTreeProvider;
        this.historyProvider = new HistoryTreeProvider(historyManager);

        // Forward events from child providers
        this.publishProvider.onDidChangeTreeData(() => this._onDidChangeTreeData.fire());
        this.watchProvider.onDidChangeTreeData(() => this._onDidChangeTreeData.fire());
        this.debugProvider.onDidChangeTreeData(() => this._onDidChangeTreeData.fire());
        this.historyProvider.onDidChangeTreeData(() => this._onDidChangeTreeData.fire());
    }

    refresh(): void {
        this.publishProvider.refresh();
        this.watchProvider.refresh();
        this.debugProvider.refresh();
        this.historyProvider.refresh();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
        if (!element) {
            // Root levet: Show 4 main features
            return [
                new FeatureRootItem('Publish', 'publishRoot', vscode.TreeItemCollapsibleState.Expanded),
                new FeatureRootItem('Watch', 'watchRoot', vscode.TreeItemCollapsibleState.Collapsed),
                new FeatureRootItem('Debug', 'debugRoot', vscode.TreeItemCollapsibleState.Collapsed),
                new FeatureRootItem('History', 'historyRoot', vscode.TreeItemCollapsibleState.Collapsed),
            ];
        }

        // Delegate to child providers based on context value
        if (element instanceof FeatureRootItem) {
            switch (element.contextValue) {
                case 'publishRoot':
                    return this.publishProvider.getChildren(); // Get root of publish
                case 'watchRoot':
                    return this.watchProvider.getChildren();
                case 'debugRoot':
                    return this.debugProvider.getChildren();
                case 'historyRoot':
                    return this.historyProvider.getChildren();
            }
        }

        // Handle items from child providers
        // Note: This requires child providers to handle their own items properly.
        // Since we are mixing types, we need to check which provider validates the item.
        // For simplicity in this unified view, we assume standard items.

        // If it's a Publish item (folder, project, profile)
        if (element instanceof PublishTreeItem) {
            return this.publishProvider.getChildren(element);
        }

        // Watch items
        if (this.isWatchItem(element)) {
            return this.watchProvider.getChildren(element as WatchTreeItem);
        }

        // Debug items
        if (this.isDebugItem(element)) {
            return this.debugProvider.getChildren(element as DebugTreeItem);
        }

        // History items
        if (element instanceof HistoryTreeItem) {
            return this.historyProvider.getChildren(element);
        }

        return [];
    }

    private isWatchItem(element: vscode.TreeItem): boolean {
        return element instanceof GroupContainerItem ||
            element instanceof ProjectContainerItem ||
            element instanceof RunningWatchItem ||
            element instanceof WatchGroupItem ||
            element instanceof ProjectItem ||
            element instanceof InfoItem;
    }

    private isDebugItem(element: vscode.TreeItem): boolean {
        return element instanceof DebugGroupContainerItem ||
            element instanceof DebugProjectContainerItem ||
            element instanceof DebugGroupItem ||
            element instanceof DebugProjectItem ||
            element instanceof DebugInfoItem ||
            element instanceof DebugWarningItem;
    }
}

class FeatureRootItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly contextValue: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.setupIcon();
    }

    private setupIcon() {
        switch (this.contextValue) {
            case 'publishRoot':
                this.iconPath = new vscode.ThemeIcon('rocket');
                this.tooltip = "Manage deployment profiles";
                break;
            case 'watchRoot':
                this.iconPath = new vscode.ThemeIcon('eye');
                this.tooltip = "Manage watch instances";
                break;
            case 'debugRoot':
                this.iconPath = new vscode.ThemeIcon('debug-alt');
                this.tooltip = "Debug configurations";
                break;
            case 'historyRoot':
                this.iconPath = new vscode.ThemeIcon('history');
                this.tooltip = "Deployment history";
                break;
        }
    }
}
