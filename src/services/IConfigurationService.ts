/**
 * Configuration Service Interface
 * Centralizes access to VS Code configuration
 * Follows Single Responsibility Principle
 */
export interface IConfigurationService {
    /**
     * Get password storage type (envvar, secret, keychain)
     */
    getPasswordStorageType(): string;

    /**
     * Get maximum number of history entries to keep
     */
    getHistoryMaxEntries(): number;

    /**
     * Get workspace root path
     */
    getWorkspaceRoot(): string | undefined;
}
