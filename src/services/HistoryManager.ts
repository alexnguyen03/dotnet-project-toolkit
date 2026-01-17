import * as vscode from 'vscode';
import { DeploymentRecord } from '../models/DeploymentRecord';

export class HistoryManager {
    private static readonly STORAGE_KEY = 'dotnet-toolkit.deployment-history';

    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Add a new deployment record to history
     */
    async addDeployment(record: Omit<DeploymentRecord, 'id'>): Promise<string> {
        const id = Math.random().toString(36).substring(2, 9);
        const newRecord: DeploymentRecord = { ...record, id };

        const history = this.getAllHistory();
        history.unshift(newRecord); // Add to beginning (most recent first)

        await this.saveHistory(history);
        return id;
    }

    /**
     * Update an existing deployment record
     */
    async updateDeployment(id: string, updates: Partial<DeploymentRecord>): Promise<void> {
        const history = this.getAllHistory();
        const index = history.findIndex(r => r.id === id);

        if (index !== -1) {
            history[index] = { ...history[index], ...updates };
            await this.saveHistory(history);
        }
    }

    /**
     * Get all deployment records from history
     */
    getAllHistory(): DeploymentRecord[] {
        return this.context.globalState.get<DeploymentRecord[]>(HistoryManager.STORAGE_KEY, []);
    }

    /**
     * Get current number of records
     */
    getHistoryCount(): number {
        return this.getAllHistory().length;
    }

    /**
     * Remove a single record from history
     */
    async clearEntry(id: string): Promise<void> {
        const history = this.getAllHistory();
        const filtered = history.filter(r => r.id !== id);
        await this.saveHistory(filtered);
    }

    /**
     * Clear all history
     */
    async clearHistory(): Promise<void> {
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, []);
    }

    /**
     * Save history to global state with max entries limit enforcement
     */
    private async saveHistory(history: DeploymentRecord[]): Promise<void> {
        const maxEntries = vscode.workspace.getConfiguration('dotnetToolkit').get<number>('historyMaxEntries', 50);

        // Keep only the most recent N entries
        const prunedHistory = history.slice(0, maxEntries);

        await this.context.globalState.update(HistoryManager.STORAGE_KEY, prunedHistory);
    }
}
