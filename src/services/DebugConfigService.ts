import * as vscode from 'vscode';
import { DebugGroup } from '../models/DebugModels';

/**
 * Service for managing debug group configurations
 */
export class DebugConfigService {
	private static readonly STORAGE_KEY = 'dotnet-toolkit.debugGroups';

	constructor(private readonly context: vscode.ExtensionContext) {}

	/**
	 * Get all debug groups
	 */
	getGroups(): DebugGroup[] {
		return this.context.globalState.get<DebugGroup[]>(DebugConfigService.STORAGE_KEY, []);
	}

	/**
	 * Add a new debug group
	 */
	async addGroup(group: DebugGroup): Promise<void> {
		const groups = this.getGroups();

		// Check for duplicate names
		if (groups.some((g) => g.name === group.name)) {
			throw new Error(`Debug group "${group.name}" already exists`);
		}

		groups.push(group);
		await this.context.globalState.update(DebugConfigService.STORAGE_KEY, groups);
	}

	/**
	 * Update an existing debug group
	 */
	async updateGroup(oldName: string, updatedGroup: DebugGroup): Promise<void> {
		const groups = this.getGroups();
		const index = groups.findIndex((g) => g.name === oldName);

		if (index === -1) {
			throw new Error(`Debug group "${oldName}" not found`);
		}

		groups[index] = updatedGroup;
		await this.context.globalState.update(DebugConfigService.STORAGE_KEY, groups);
	}

	/**
	 * Delete a debug group
	 */
	async deleteGroup(name: string): Promise<void> {
		const groups = this.getGroups();
		const filtered = groups.filter((g) => g.name !== name);

		if (filtered.length === groups.length) {
			throw new Error(`Debug group "${name}" not found`);
		}

		await this.context.globalState.update(DebugConfigService.STORAGE_KEY, filtered);
	}

	/**
	 * Clear all debug groups
	 */
	async clearAll(): Promise<void> {
		await this.context.globalState.update(DebugConfigService.STORAGE_KEY, []);
	}
}
