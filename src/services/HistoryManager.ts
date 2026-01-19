import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DeploymentRecord } from '../models/DeploymentRecord';

interface HistoryFileContent {
	version: number;
	records: DeploymentRecord[];
}

export class HistoryManager {
	private historyCache: DeploymentRecord[] = [];
	private readonly STORAGE_FILE = 'deployment-history.json';
	private readonly CURRENT_VERSION = 1;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Initial load
		this.refreshHistory();
	}

	/**
	 * Add a new deployment record to history
	 */
	async addDeployment(
		record: Omit<DeploymentRecord, 'id'>,
		profilePath: string
	): Promise<string> {
		const id = Math.random().toString(36).substring(2, 9);
		const newRecord: DeploymentRecord = { ...record, id };

		// 1. Read existing
		await this.loadFromStorage();

		// 2. Add new record
		this.historyCache.unshift(newRecord);

		// 3. Prune if needed
		const maxEntries = 50; // Hardcoded limit since configuration was removed
		if (this.historyCache.length > maxEntries) {
			this.historyCache = this.historyCache.slice(0, maxEntries);
		}

		// 4. Save
		await this.saveToStorage();

		return id;
	}

	/**
	 * Update an existing deployment record
	 */
	async updateDeployment(
		id: string,
		updates: Partial<DeploymentRecord>,
		profilePath: string
	): Promise<void> {
		await this.loadFromStorage();

		const index = this.historyCache.findIndex((r) => r.id === id);
		if (index !== -1) {
			this.historyCache[index] = { ...this.historyCache[index], ...updates };
			await this.saveToStorage();
		}
	}

	/**
	 * Get all deployment records from cache
	 */
	getAllHistory(): DeploymentRecord[] {
		return this.historyCache;
	}

	/**
	 * Get history count
	 */
	getHistoryCount(): number {
		return this.historyCache.length;
	}

	/**
	 * Clear all history
	 */
	async clearHistory(): Promise<void> {
		this.historyCache = [];
		await this.saveToStorage();
	}

	/**
	 * Remove a single entry by ID
	 */
	async clearEntry(id: string): Promise<void> {
		await this.loadFromStorage();
		const index = this.historyCache.findIndex((r) => r.id === id);
		if (index !== -1) {
			this.historyCache.splice(index, 1);
			await this.saveToStorage();
		}
	}

	/**
	 * Refresh the in-memory cache
	 */
	async refreshHistory(): Promise<void> {
		await this.loadFromStorage();
	}

	private async ensureStorageDir(): Promise<void> {
		if (this.context.storageUri) {
			try {
				await fs.promises.mkdir(this.context.storageUri.fsPath, { recursive: true });
			} catch (error) {
				// Ignore if exists
			}
		}
	}

	private getHistoryFilePath(): string | undefined {
		if (!this.context.storageUri) {
			return undefined;
		}
		return path.join(this.context.storageUri.fsPath, this.STORAGE_FILE);
	}

	private async loadFromStorage(): Promise<void> {
		const filePath = this.getHistoryFilePath();
		if (!filePath || !fs.existsSync(filePath)) {
			this.historyCache = [];
			return;
		}

		try {
			const content = await fs.promises.readFile(filePath, 'utf-8');
			const data = JSON.parse(content) as HistoryFileContent;

			// Handle migration if we change version later
			if (data && Array.isArray(data.records)) {
				this.historyCache = data.records;
			} else {
				this.historyCache = [];
			}

			// Sort by startTime descending
			this.historyCache.sort(
				(a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
			);
		} catch (error) {
			console.error('Failed to load history:', error);
			this.historyCache = [];
		}
	}

	private async saveToStorage(): Promise<void> {
		const filePath = this.getHistoryFilePath();
		if (!filePath) {
			return;
		}

		await this.ensureStorageDir();

		const data: HistoryFileContent = {
			version: this.CURRENT_VERSION,
			records: this.historyCache,
		};

		try {
			await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
		} catch (error) {
			console.error('Failed to save history:', error);
		}
	}
}
