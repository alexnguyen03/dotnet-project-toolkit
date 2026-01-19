/**
 * Configuration Service Interface
 * Centralizes access to VS Code configuration
 * Follows Single Responsibility Principle
 */
export interface IConfigurationService {
	/**
	 * Get password storage type (secret, envvar)
	 */
	getPasswordStorageType(): string;

	/**
	 * Get path to dotnet CLI executable
	 */
	getDotnetPath(): string;

	/**
	 * Should browser be opened after deployment
	 */
	getOpenBrowserOnDeploy(): boolean;

	/**
	 * Get workspace root path
	 */
	getWorkspaceRoot(): string | undefined;
}
