import * as vscode from 'vscode';

/**
 * Password storage strategy interface - Strategy Pattern
 * Allows different password storage backends
 */
export interface IPasswordStorage {
    /**
     * Storage type identifier
     */
    readonly type: 'envvar' | 'secret' | 'keychain';

    /**
     * Store a password
     * @param key Unique key for the password
     * @param value Password value
     * @returns Success status
     */
    store(key: string, value: string): Promise<boolean>;

    /**
     * Retrieve a password
     * @param key Unique key for the password
     * @returns Password value or undefined if not found
     */
    retrieve(key: string): Promise<string | undefined>;

    /**
     * Delete a password
     * @param key Unique key for the password
     * @returns Success status
     */
    delete(key: string): Promise<boolean>;

    /**
     * Generate standardized key name
     * @param projectName Project name
     * @param profileName Profile name
     */
    generateKey(projectName: string, profileName: string): string;
}

/**
 * Base class for password storage with common utilities
 */
export abstract class BasePasswordStorage implements IPasswordStorage {
    abstract readonly type: 'envvar' | 'secret' | 'keychain';

    constructor(
        protected readonly outputChannel: vscode.OutputChannel
    ) {}

    abstract store(key: string, value: string): Promise<boolean>;
    abstract retrieve(key: string): Promise<string | undefined>;
    abstract delete(key: string): Promise<boolean>;

    generateKey(projectName: string, profileName: string): string {
        const sanitizedProject = projectName
            .replace(/\./g, '_')
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_')
            .replace(/_+/g, '_');
        const sanitizedProfile = profileName
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_');
        return `DEPLOY_PWD_${sanitizedProject}_${sanitizedProfile}`;
    }

    protected log(message: string): void {
        this.outputChannel.appendLine(`[PasswordStorage:${this.type}] ${message}`);
    }
}
