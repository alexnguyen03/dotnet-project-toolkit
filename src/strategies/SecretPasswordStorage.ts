import * as vscode from 'vscode';
import { BasePasswordStorage } from './IPasswordStorage';

/**
 * VS Code SecretStorage Password Strategy
 * Uses VS Code's built-in encrypted secret storage
 * - Cross-platform
 * - Encrypted by OS keychain
 * - Syncs with Settings Sync
 */
export class SecretPasswordStorage extends BasePasswordStorage {
	readonly type = 'secret' as const;

	constructor(
		outputChannel: vscode.OutputChannel,
		private readonly secrets: vscode.SecretStorage
	) {
		super(outputChannel);
	}

	async store(key: string, value: string): Promise<boolean> {
		if (!key || !value) {
			this.log('Error: Key and value are required');
			return false;
		}
		try {
			await this.secrets.store(key, value);
			this.log(`Stored securely: ${key}`);
			return true;
		} catch (error) {
			this.log(`Error storing: ${error}`);
			return false;
		}
	}

	async retrieve(key: string): Promise<string | undefined> {
		if (!key) {
			this.log('Warning: Empty key provided to retrieve');
			return undefined;
		}
		try {
			return await this.secrets.get(key);
		} catch (error) {
			this.log(`Error retrieving: ${error}`);
			return undefined;
		}
	}

	async delete(key: string): Promise<boolean> {
		if (!key) {
			this.log('Warning: Empty key provided to delete');
			return false;
		}
		try {
			await this.secrets.delete(key);
			this.log(`Deleted: ${key}`);
			return true;
		} catch (error) {
			this.log(`Error deleting: ${error}`);
			return false;
		}
	}
}
