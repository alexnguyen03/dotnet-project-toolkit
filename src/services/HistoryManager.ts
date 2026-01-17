import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { DeploymentRecord } from '../models/DeploymentRecord';

interface HistoryFileContent {
    DeploymentHistory: {
        Deployments: {
            DeploymentRecord: DeploymentRecord[];
        }
    }
}

export class HistoryManager {
    private historyCache: DeploymentRecord[] = [];
    private readonly parser: XMLParser;
    private readonly builder: XMLBuilder;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.parser = new XMLParser({
            ignoreAttributes: false,
            parseTagValue: true
        });

        this.builder = new XMLBuilder({
            ignoreAttributes: false,
            format: true,
            indentBy: '  '
        });

        // Initial load
        this.refreshHistory();
    }

    /**
     * Add a new deployment record to history file
     */
    async addDeployment(record: Omit<DeploymentRecord, 'id'>, profilePath: string): Promise<string> {
        const id = Math.random().toString(36).substring(2, 9);
        const newRecord: DeploymentRecord = { ...record, id };

        // 1. Determine history file path
        const historyPath = this.getHistoryFilePath(profilePath);

        // 2. Read existing history for this profile
        let profileHistory = await this.readHistoryFile(historyPath);

        // 3. Add new record
        profileHistory.unshift(newRecord);

        // 4. Prune if needed (per file limit)
        const maxEntries = vscode.workspace.getConfiguration('dotnetToolkit').get<number>('historyMaxEntries', 50);
        if (profileHistory.length > maxEntries) {
            profileHistory = profileHistory.slice(0, maxEntries);
        }

        // 5. Save back to file
        await this.writeHistoryFile(historyPath, profileHistory);

        // 6. Refresh global cache
        await this.refreshHistory();

        return id;
    }

    /**
     * Update an existing deployment record
     */
    async updateDeployment(id: string, updates: Partial<DeploymentRecord>, profilePath: string): Promise<void> {
        const historyPath = this.getHistoryFilePath(profilePath);
        let profileHistory = await this.readHistoryFile(historyPath);

        const index = profileHistory.findIndex(r => r.id === id);
        if (index !== -1) {
            profileHistory[index] = { ...profileHistory[index], ...updates };
            await this.writeHistoryFile(historyPath, profileHistory);
            await this.refreshHistory();
        }
    }

    /**
     * Get all deployment records from cache (aggregated from all files)
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
     * Clear all history (deletes all .pubhisxml files)
     */
    async clearHistory(): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.pubhisxml');
        for (const file of files) {
            try {
                await fs.promises.unlink(file.fsPath);
            } catch (error) {
                console.error(`Failed to delete history file: ${file.fsPath}`, error);
            }
        }
        await this.refreshHistory();
    }

    /**
     * Remove a single entry by ID (Search all files)
     */
    async clearEntry(id: string): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.pubhisxml');

        for (const file of files) {
            const history = await this.readHistoryFile(file.fsPath);
            const index = history.findIndex(r => r.id === id);

            if (index !== -1) {
                history.splice(index, 1);
                // If empty, maybe delete file? For now just save empty list
                if (history.length === 0) {
                    await fs.promises.unlink(file.fsPath);
                } else {
                    await this.writeHistoryFile(file.fsPath, history);
                }
                break; // Found and deleted
            }
        }
        await this.refreshHistory();
    }

    /**
     * Refresh the in-memory cache by scanning all .pubhisxml files
     */
    async refreshHistory(): Promise<void> {
        const files = await vscode.workspace.findFiles('**/*.pubhisxml');
        let allHistory: DeploymentRecord[] = [];

        for (const file of files) {
            const fileHistory = await this.readHistoryFile(file.fsPath);
            allHistory = allHistory.concat(fileHistory);
        }

        // Sort by startTime descending
        allHistory.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        this.historyCache = allHistory;
    }

    private getHistoryFilePath(profilePath: string): string {
        // profilePath is like /path/to/profile.pubxml
        // historyPath will be /path/to/profile.pubhisxml
        const parsed = path.parse(profilePath);
        return path.join(parsed.dir, `${parsed.name}.pubhisxml`);
    }

    private async readHistoryFile(filePath: string): Promise<DeploymentRecord[]> {
        if (!fs.existsSync(filePath)) {
            return [];
        }

        try {
            const xmlContent = await fs.promises.readFile(filePath, 'utf-8');
            const result = this.parser.parse(xmlContent);

            // Handle XML parsing structure
            const deployments = result?.DeploymentHistory?.Deployments?.DeploymentRecord;

            if (Array.isArray(deployments)) {
                return deployments;
            } else if (deployments) {
                return [deployments]; // Single item
            }
            return [];
        } catch (error) {
            console.error(`Error reading history file ${filePath}:`, error);
            return [];
        }
    }

    private async writeHistoryFile(filePath: string, history: DeploymentRecord[]): Promise<void> {
        const xmlObj: HistoryFileContent = {
            DeploymentHistory: {
                Deployments: {
                    DeploymentRecord: history
                }
            }
        };

        const xmlContent = this.builder.build(xmlObj);
        await fs.promises.writeFile(filePath, xmlContent, 'utf-8');
    }
}
