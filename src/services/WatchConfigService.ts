import * as vscode from 'vscode';
import { WatchGroup } from '../models/WatchModels';

export class WatchConfigService {
    private static readonly KEY_WATCH_GROUPS = 'dotnet-toolkit.watch.groups';

    constructor(private readonly context: vscode.ExtensionContext) { }

    public getGroups(): WatchGroup[] {
        return this.context.globalState.get<WatchGroup[]>(WatchConfigService.KEY_WATCH_GROUPS, []);
    }

    public async saveGroup(group: WatchGroup): Promise<void> {
        const groups = this.getGroups();
        const index = groups.findIndex(g => g.id === group.id);

        if (index >= 0) {
            groups[index] = group;
        } else {
            groups.push(group);
        }

        await this.context.globalState.update(WatchConfigService.KEY_WATCH_GROUPS, groups);
    }

    public async deleteGroup(id: string): Promise<void> {
        const groups = this.getGroups().filter(g => g.id !== id);
        await this.context.globalState.update(WatchConfigService.KEY_WATCH_GROUPS, groups);
    }

    public getGroup(id: string): WatchGroup | undefined {
        return this.getGroups().find(g => g.id === id);
    }

    /**
     * Generates a simple unique ID
     */
    public generateId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}
