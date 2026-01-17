/**
 * Represents a single deployment record in the history
 */
export interface DeploymentRecord {
    /** Unique identifier for this deployment */
    id: string;

    /** Name of the publish profile (e.g., "uat-api [UAT]") */
    profileName: string;

    /** Name of the project being deployed (e.g., "BudgetControl.Server.Api") */
    projectName: string;

    /** Target environment */
    environment: 'UAT' | 'PROD' | 'DEV';

    /** Deployment status */
    status: 'success' | 'failed' | 'in-progress';

    /** When the deployment started */
    startTime: string; // ISO 8601 format for JSON serialization

    /** When the deployment ended (if completed) */
    endTime?: string; // ISO 8601 format

    /** Duration in milliseconds */
    duration?: number;

    /** Error message if deployment failed */
    errorMessage?: string;
}

/**
 * Helper functions for working with deployment records
 */
export class DeploymentRecordHelper {
    /**
     * Format duration in human-readable format
     */
    static formatDuration(milliseconds: number): string {
        const seconds = milliseconds / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Format timestamp in user-friendly format
     */
    static formatTimestamp(isoString: string): string {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        // Less than 1 minute ago
        if (diffMins < 1) {
            return 'Just now';
        }
        // Less than 1 hour ago
        if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        }
        // Less than 24 hours ago
        if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        }
        // Less than 7 days ago
        if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        }
        // Older - show full date
        return date.toLocaleString();
    }

    /**
     * Get relative date group for grouping in UI
     */
    static getDateGroup(isoString: string): 'Today' | 'Yesterday' | 'This Week' | 'Older' {
        const date = new Date(isoString);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        if (date >= today) {
            return 'Today';
        }
        if (date >= yesterday) {
            return 'Yesterday';
        }
        if (date >= weekAgo) {
            return 'This Week';
        }
        return 'Older';
    }
}
