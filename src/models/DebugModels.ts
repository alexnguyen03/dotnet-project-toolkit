/**
 * Model definitions for Debug feature
 */

export interface DebugGroup {
	/** Unique name for the debug group */
	name: string;

	/** List of project names to debug together */
	projects: string[];

	/** Optional launch settings/arguments */
	launchSettings?: string;
}
