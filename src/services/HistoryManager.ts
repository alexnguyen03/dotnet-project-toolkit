import * as vscode from 'vscode';
import { DeploymentRecord } from '../models/DeploymentRecord';
import { randomUUID } from 'crypto';

/**
 * Manages deployment history storage and retrieval
 */
export class HistoryManager {
    private static readonly STORAGE_KEY = 'dotnet-toolkit.deploymentHistory';
    private static readonly DEFAULT_MAX_ENTRIES = 50;

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Get maximum number of history entries to keep
     */
    private getMaxEntries(): number {
        return vscode.workspace.getConfiguration('dotnetToolkit').get('historyMaxEntries', HistoryManager.DEFAULT_MAX_ENTRIES);
    }

    /**
     * Load all deployment history from storage
     */
    getAllHistory(): DeploymentRecord[] {
        const history = this.context.globalState.get<DeploymentRecord[]>(HistoryManager.STORAGE_KEY, []);
        // Sort by start time descending (newest first)
        return history.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }

    /**
     * Get deployment history for a specific profile
     */
    getHistoryByProfile(profileName: string): DeploymentRecord[] {
        return this.getAllHistory().filter(record => record.profileName === profileName);
    }

    /**
     * Get deployment history for a specific project
     */
    getHistoryByProject(projectName: string): DeploymentRecord[] {
        return this.getAllHistory().filter(record => record.projectName === projectName);
    }

    /**
     * Add a new deployment record
     */
    async addDeployment(record: Omit<DeploymentRecord, 'id'>): Promise<string> {
        const history = this.getAllHistory();

        // Generate unique ID
        const id = randomUUID();
        const newRecord: DeploymentRecord = {
            id,
            ...record
        };

        // Add to beginning of array (newest first)
        history.unshift(newRecord);

        // Trim to max entries
        const maxEntries = this.getMaxEntries();
        if (history.length > maxEntries) {
            history.splice(maxEntries);
        }

        await this.context.globalState.update(HistoryManager.STORAGE_KEY, history);
        return id;
    }

    /**
     * Update an existing deployment record
     */
    async updateDeployment(id: string, updates: Partial<DeploymentRecord>): Promise<void> {
        const history = this.getAllHistory();
        const index = history.findIndex(record => record.id === id);

        if (index === -1) {
            throw new Error(`Deployment record with id ${id} not found`);
        }

        // Merge updates
        history[index] = {
            ...history[index],
            ...updates
        };

        await this.context.globalState.update(HistoryManager.STORAGE_KEY, history);
    }

    /**
     * Clear all deployment history
     */
    async clearHistory(): Promise<void> {
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, []);
    }

    /**
     * Clear a specific deployment entry
     */
    async clearEntry(id: string): Promise<void> {
        const history = this.getAllHistory();
        const filtered = history.filter(record => record.id !== id);
        await this.context.globalState.update(HistoryManager.STORAGE_KEY, filtered);
    }

    /**
     * Get the count of total deployments
     */
    getHistoryCount(): number {
        return this.getAllHistory().length;
    }

    /**
     * Get recent deployments (last N entries)
     */
    getRecentHistory(count: number = 10): DeploymentRecord[] {
        return this.getAllHistory().slice(0, count);
    }
}
