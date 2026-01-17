import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PublishProfileInfo, ProjectInfo } from '../models/ProjectModels';
import { IProfileService, ProfileWizardData } from '../services/ProfileService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { HistoryManager } from '../services/HistoryManager';
import { DeploymentRecordHelper } from '../models/DeploymentRecord';

/**
 * Profile Info Webview Panel
 * Shows profile details and allows editing
 */
export class ProfileInfoPanel {
    public static currentPanel: ProfileInfoPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    // Store mutable state
    private currentProfileInfo: PublishProfileInfo;
    private currentProjectName: string;

    private constructor(
        panel: vscode.WebviewPanel,
        profileInfo: PublishProfileInfo,
        projectName: string,
        private readonly profileService: IProfileService,
        private readonly passwordStorage: IPasswordStorage,
        private readonly historyManager: HistoryManager,
        private readonly outputChannel: vscode.OutputChannel,
        private readonly onRefresh: () => void
    ) {
        this.panel = panel;
        this.currentProfileInfo = profileInfo;
        this.currentProjectName = projectName;

        // Set initial HTML content
        this.update();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'save':
                        await this.saveProfile(message.data);
                        break;
                    case 'close':
                        this.panel.dispose();
                        break;
                    case 'openFile':
                        // Open the .pubxml file in editor
                        const uri = vscode.Uri.file(this.currentProfileInfo.path);
                        await vscode.window.showTextDocument(uri, { preview: false });
                        break;
                    case 'deploy':
                        await vscode.commands.executeCommand('dotnet-project-toolkit.deployProfile', {
                            profileInfo: this.currentProfileInfo,
                            projectName: this.currentProjectName
                        });
                        break;
                    case 'delete':
                        await vscode.commands.executeCommand('dotnet-project-toolkit.deletePublishProfile', {
                            profileInfo: this.currentProfileInfo,
                            projectName: this.currentProjectName
                        });
                        // Close panel if file was deleted
                        if (!fs.existsSync(this.currentProfileInfo.path)) {
                            this.panel.dispose();
                        }
                        break;
                }
            },
            null,
            this.disposables
        );

        // Handle disposal
        this.panel.onDidDispose(
            () => this.dispose(),
            null,
            this.disposables
        );
    }

    /**
     * Update panel with new profile data (reuse same tab)
     */
    public updateWithProfile(profileInfo: PublishProfileInfo, projectName: string) {
        this.currentProfileInfo = profileInfo;
        this.currentProjectName = projectName;
        this.panel.title = `${projectName} / ${profileInfo.fileName}`;
        this.update();
    }

    public static show(
        extensionUri: vscode.Uri,
        profileInfo: PublishProfileInfo,
        projectName: string,
        profileService: IProfileService,
        passwordStorage: IPasswordStorage,
        historyManager: HistoryManager,
        outputChannel: vscode.OutputChannel,
        onRefresh: () => void
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If panel exists, update it with new data and reveal
        if (ProfileInfoPanel.currentPanel) {
            ProfileInfoPanel.currentPanel.updateWithProfile(profileInfo, projectName);
            ProfileInfoPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'profileInfo',
            `${projectName} / ${profileInfo.fileName}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ProfileInfoPanel.currentPanel = new ProfileInfoPanel(
            panel,
            profileInfo,
            projectName,
            profileService,
            passwordStorage,
            historyManager,
            outputChannel,
            onRefresh
        );
    }

    private async saveProfile(data: ProfileWizardData) {
        try {
            this.outputChannel.appendLine(`[ProfileInfo] Saving: ${data.profileName}`);

            // Create project info for service
            const projectInfo: ProjectInfo = {
                name: this.currentProjectName,
                projectDir: this.currentProfileInfo.path.replace(/[\\\/]Properties[\\\/]PublishProfiles[\\\/][^\\\/]+$/, ''),
                csprojPath: '',
                projectType: 'unknown',
                profiles: []
            };

            // Save profile
            const success = await this.profileService.create(projectInfo, data);

            if (success) {
                // Save password if changed
                if (data.password && data.password !== 'KEEP_EXISTING') {
                    const passwordKey = this.passwordStorage.generateKey(this.currentProjectName, data.profileName);
                    await this.passwordStorage.store(passwordKey, data.password);
                }

                vscode.window.showInformationMessage(`✅ Profile "${data.profileName}" saved!`);

                // Reload profile info from disk to get updated properties
                const updatedProfile = this.profileService.parse(this.currentProfileInfo.path);
                if (updatedProfile) {
                    this.currentProfileInfo = updatedProfile;
                    this.panel.title = `${this.currentProjectName} / ${updatedProfile.fileName}`;
                }

                this.onRefresh();
                this.update(); // Re-render webview with new data
                this.outputChannel.appendLine(`[ProfileInfo] ✓ Saved and reloaded successfully`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save: ${error}`);
            this.outputChannel.appendLine(`[ProfileInfo] Error: ${error}`);
        }
    }

    public update() {
        const passwordKey = this.passwordStorage.generateKey(this.currentProjectName, this.currentProfileInfo.fileName);

        this.panel.webview.html = this.getHtmlContent(passwordKey);
    }

    private getHtmlContent(passwordKey: string): string {
        const profile = this.currentProfileInfo;
        const envBadge = this.getEnvBadge(profile.environment);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile: ${profile.fileName}</title>
    <style>
        :root {
            --bg: var(--vscode-editor-background);
            --fg: var(--vscode-editor-foreground);
            --input-bg: var(--vscode-input-background);
            --input-border: var(--vscode-input-border);
            --btn-bg: var(--vscode-button-background);
            --btn-fg: var(--vscode-button-foreground);
            --btn-hover: var(--vscode-button-hoverBackground);
            --error: var(--vscode-errorForeground);
            --success: #4caf50;
            --warning: #ff9800;
            --danger: #d32f2f;
            --danger-hover: #b71c1c;
        }
        
        body {
            font-family: var(--vscode-font-family);
            background: var(--bg);
            color: var(--fg);
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        }
        
        h1 {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 20px;
            font-size: 1.5em;
        }
        
        .badge {
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.7em;
            font-weight: bold;
            text-transform: uppercase;
        }
        
        .badge.uat { background: #2196f3; color: white; }
        .badge.prod { background: #f44336; color: white; }
        .badge.dev { background: #4caf50; color: white; }
        .badge.unknown { background: #9e9e9e; color: white; }
        
        .form-group {
            margin-bottom: 16px;
        }
        
        label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            font-size: 0.9em;
        }
        
        input, select {
            width: 100%;
            padding: 8px 12px;
            background: var(--input-bg);
            border: 1px solid var(--input-border);
            color: var(--fg);
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        input:focus, select:focus {
            outline: 1px solid var(--btn-bg);
        }
        
        input[readonly] {
            opacity: 0.7;
            cursor: not-allowed;
        }
        
        .hint {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        
        .actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 24px;
            padding-top: 16px;
            border-top: 1px solid var(--input-border);
        }

        .actions-left {
            display: flex;
            gap: 10px;
        }
        
        button {
            height: 32px;
            padding: 0 16px;
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            transition: all 0.2s;
            outline: none;
        }
        
        button:active {
            transform: translateY(1px);
        }

        .btn-primary {
            background: var(--btn-bg);
            color: var(--btn-fg);
        }
        
        .btn-primary:hover {
            background: var(--btn-hover);
        }
        
        .btn-secondary {
            background: transparent;
            border-color: var(--input-border);
            color: var(--fg);
        }
        
        .btn-secondary:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .info-box {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid var(--btn-bg);
            padding: 12px;
            margin-bottom: 20px;
            font-size: 0.9em;
        }
        
        .info-box code {
            background: var(--input-bg);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }
        
        .header {
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--input-border);
        }

        .title-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
        }
        
        .titles {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .project-header {
            font-size: 1.5em;
            font-weight: 600;
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--fg);
        }
        
        .profile-subheader {
            color: var(--vscode-textLink-foreground);
            margin: 0;
            font-weight: 500;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: opacity 0.2s;
        }

        .profile-subheader:hover {
            opacity: 0.8;
            text-decoration: underline;
        }
        
        .link-icon {
            font-size: 0.8em;
            opacity: 0.7;
        }
        
        .icon-btn {
            padding: 6px 12px;
            background: transparent;
            border: 1px solid var(--input-border);
            color: var(--fg);
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            white-space: nowrap;
        }
        
        .icon-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .toolbar {
            display: flex;
            gap: 12px;
            align-items: center;
        }

        .btn-success {
            background: var(--success);
            color: white;
        }
        
        .btn-success:hover {
            filter: brightness(1.1);
        }

        .btn-danger {
            background: var(--danger);
            color: white;
        }

        .btn-danger:hover {
            background: var(--danger-hover);
        }
        
        .icon-link {
            cursor: pointer;
            font-size: 0.9em;
            margin: 0 8px;
            opacity: 0.6;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            border-radius: 4px;
        }
        
        .icon-link:hover {
            opacity: 1;
            background: var(--vscode-toolbar-hoverBackground);
        }
        
        .history-section {
            margin-top: 32px;
            padding-top: 16px;
            border-top: 1px solid var(--input-border);
        }
        
        .history-section h2 {
            font-size: 1.1em;
            margin-bottom: 12px;
        }
        
        .history-placeholder {
            background: var(--vscode-textBlockQuote-background);
            padding: 16px;
            border-radius: 4px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
        }
        
        .history-placeholder p {
            margin: 0 0 8px 0;
        }
        
        .error-box {
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 16px;
        }
        
        .error-box ul {
            margin: 8px 0 0 0;
            padding-left: 20px;
        }
        
        .error-box li {
            margin: 4px 0;
        }

        .history-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .history-item {
            background: var(--vscode-textBlockQuote-background);
            border-left: 3px solid #ccc;
            padding: 10px 12px;
            border-radius: 0 4px 4px 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .history-item.success { border-left-color: var(--success); }
        .history-item.failed { border-left-color: var(--danger); }
        .history-item.in-progress { border-left-color: var(--warning); }

        .history-info {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .history-status {
            font-weight: 600;
            font-size: 0.9em;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .history-time {
            font-size: 0.8em;
            color: var(--vscode-descriptionForeground);
        }

        .history-duration {
            font-size: 0.8em;
            opacity: 0.8;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title-row">
            <div class="titles">
                <h1 class="project-header">
                    📦 ${this.currentProjectName}
                </h1>
                <h2 class="profile-subheader" onclick="openFile()" title="Click to open .pubxml file">
                    ${profile.fileName}
                </h2>
            </div>
            <div class="toolbar">
                <span class="badge ${profile.environment}">${profile.environment.toUpperCase()}</span>
                <button type="button" class="btn-success" onclick="deploy()" title="Deploy to this environment">
                    🚀 Deploy
                </button>
            </div>
        </div>
    </div>
    
    <div class="info-box">
        <strong>Password Variable:</strong> <code>${passwordKey}</code><br>
        <small>Used when deploying: <code>/p:Password=$env:${passwordKey}</code></small>
    </div>
    
    <form id="profileForm">
        
        <div class="form-group">
            <label>Environment</label>
            <select id="environment">
                <option value="uat" ${profile.environment === 'uat' ? 'selected' : ''}>UAT - Testing</option>
                <option value="prod" ${profile.environment === 'prod' ? 'selected' : ''}>PROD - Production ⚠️</option>
                <option value="dev" ${profile.environment === 'dev' ? 'selected' : ''}>DEV - Development</option>
            </select>
        </div>
        
        <div class="form-group">
            <label>Publish URL (IP or Domain)</label>
            <input type="text" id="publishUrl" value="${profile.publishUrl || ''}" placeholder="192.168.10.3">
        </div>
        
        <div class="form-group">
            <label>IIS Site Name</label>
            <input type="text" id="siteName" value="${profile.siteName || ''}" placeholder="TS_BUDGETCTRL_API_UAT">
        </div>
        
        <div class="form-group">
            <label>Site URL (for browser launch)</label>
            <input type="text" id="siteUrl" value="${profile.siteUrl || ''}" placeholder="https://example.com">
        </div>
        
        <div class="form-group">
            <label>Username</label>
            <input type="text" id="username" value="${profile.userName || ''}" placeholder="namnh">
        </div>
        
        <div class="form-group">
            <label>Password</label>
            <input type="password" id="password" placeholder="Leave empty to keep existing">
            <div class="hint">Only enter if you want to change the password</div>
        </div>
        
        <div class="actions">
            <div class="actions-left">
                <button type="submit" class="btn-primary">💾 Save Changes</button>
                <button type="button" class="btn-secondary" onclick="resetForm()">Cancel</button>
            </div>
            <button type="button" class="btn-danger" onclick="deleteProfile()" title="Delete this profile">
                🗑️ Delete
            </button>
        </div>
    </form>
    
    <div class="history-section">
        <h2>📜 Publish History</h2>
        ${this.renderHistory()}
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        // Store initial values for reset
        const profileName = '${profile.fileName}';
        const initialData = {
            environment: '${profile.environment}',
            publishUrl: '${profile.publishUrl || ''}',
            siteName: '${profile.siteName || ''}',
            siteUrl: '${profile.siteUrl || ''}',
            username: '${profile.userName || ''}',
            password: ''
        };
        
        document.getElementById('profileForm').addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Validate required fields
            const publishUrl = document.getElementById('publishUrl').value.trim();
            const siteName = document.getElementById('siteName').value.trim();
            const username = document.getElementById('username').value.trim();
            
            let errors = [];
            if (!publishUrl) errors.push('Publish URL is required');
            if (!siteName) errors.push('Site Name is required');
            if (!username) errors.push('Username is required');
            
            // Show validation errors
            clearErrors();
            if (errors.length > 0) {
                showErrors(errors);
                return;
            }
            
            const data = {
                profileName: profileName,
                environment: document.getElementById('environment').value,
                publishUrl: publishUrl,
                siteName: siteName,
                siteUrl: document.getElementById('siteUrl').value || undefined,
                username: username,
                password: document.getElementById('password').value || 'KEEP_EXISTING'
            };
            
            vscode.postMessage({ command: 'save', data });
        });
        
        function resetForm() {
            document.getElementById('environment').value = initialData.environment;
            document.getElementById('publishUrl').value = initialData.publishUrl;
            document.getElementById('siteName').value = initialData.siteName;
            document.getElementById('siteUrl').value = initialData.siteUrl;
            document.getElementById('username').value = initialData.username;
            document.getElementById('password').value = '';
            clearErrors();
        }
        
        function clearErrors() {
            const existing = document.querySelector('.error-box');
            if (existing) existing.remove();
        }
        
        function showErrors(errors) {
            const errorBox = document.createElement('div');
            errorBox.className = 'error-box';
            errorBox.innerHTML = '<strong>⚠️ Validation Errors:</strong><ul>' + 
                errors.map(e => '<li>' + e + '</li>').join('') + '</ul>';
            document.querySelector('.actions').before(errorBox);
        }
        
        function openFile() {
            vscode.postMessage({ command: 'openFile' });
        }

        function deploy() {
            vscode.postMessage({ command: 'deploy' });
        }

        function deleteProfile() {
            vscode.postMessage({ command: 'delete' });
        }
    </script>
</body>
</html>`;
    }

    private renderHistory(): string {
        const allHistory = this.historyManager.getAllHistory();
        const profileHistory = allHistory
            .filter(h => h.profileName === this.currentProfileInfo.fileName)
            .slice(0, 5); // Show last 5 entries

        if (profileHistory.length === 0) {
            return `
                <div class="history-placeholder">
                    <p>No publish history available yet.</p>
                    <small>History will be recorded when you deploy using this profile.</small>
                </div>`;
        }

        const items = profileHistory.map(h => {
            const statusIcon = h.status === 'success' ? '✅' : h.status === 'failed' ? '❌' : '⏳';
            const duration = h.duration ? DeploymentRecordHelper.formatDuration(h.duration) : '';
            const startTime = new Date(h.startTime).toLocaleString();

            return `
                <div class="history-item ${h.status}">
                    <div class="history-info">
                        <div class="history-status">${statusIcon} ${h.status.toUpperCase()}</div>
                        <div class="history-time">${startTime}</div>
                    </div>
                    <div class="history-duration">${duration}</div>
                </div>`;
        }).join('');

        return `<div class="history-list">${items}</div>`;
    }

    private getEnvBadge(env: string): string {
        const colors: Record<string, string> = {
            uat: '#2196f3',
            prod: '#f44336',
            dev: '#4caf50',
            unknown: '#9e9e9e'
        };
        return colors[env] || colors.unknown;
    }

    public dispose() {
        ProfileInfoPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) d.dispose();
        }
    }
}
