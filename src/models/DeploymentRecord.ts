import * as vscode from 'vscode';

export interface DeploymentRecord {
    id: string;
    profileName: string;
    projectName: string;
    environment: string;
    status: 'success' | 'failed' | 'in-progress';
    startTime: string; // ISO string
    endTime?: string;  // ISO string
    duration?: number; // milliseconds
    errorMessage?: string;
}

export class DeploymentRecordHelper {
    /**
     * Format duration in milliseconds to a readable string (e.g., "2.5s" or "1m 15s")
     */
    static formatDuration(ms: number): string {
        if (ms < 1000) {
            return `${ms}ms`;
        }
        const seconds = ms / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainingSeconds}s`;
    }

    /**
     * Format ISO timestamp to a readable local time string
     */
    static formatTimestamp(isoString: string): string {
        const date = new Date(isoString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Get date group name for a timestamp (Today, Yesterday, This Week, Older)
     */
    static getDateGroup(isoString: string): string {
        const date = new Date(isoString);
        const now = new Date();

        // Reset hours for comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const thisWeek = new Date(today);
        thisWeek.setDate(thisWeek.getDate() - 7);

        const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        if (targetDate.getTime() === today.getTime()) {
            return 'Today';
        } else if (targetDate.getTime() === yesterday.getTime()) {
            return 'Yesterday';
        } else if (targetDate.getTime() >= thisWeek.getTime()) {
            return 'This Week';
        } else {
            return 'Older';
        }
    }
}
