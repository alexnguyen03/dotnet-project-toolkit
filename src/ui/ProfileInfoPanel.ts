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
        public readonly extensionUri: vscode.Uri,
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
                    case 'ready':
                        await this.sendInitialData();
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
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ProfileInfoPanel.currentPanel = new ProfileInfoPanel(
            panel,
            extensionUri,
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
        // Also send data update in case webview is already loaded
        this.sendInitialData();
    }

    private async sendInitialData() {
        const passwordKey = this.passwordStorage.generateKey(this.currentProjectName, this.currentProfileInfo.fileName);
        const profile = this.currentProfileInfo;

        const data = {
            projectName: this.currentProjectName,
            profileFileName: profile.fileName,
            environment: profile.environment,
            publishUrl: profile.publishUrl,
            siteName: profile.siteName,
            siteUrl: profile.siteUrl,
            username: profile.userName,
            passwordKey: passwordKey,
            isDeploying: this.isDeploying(profile.fileName)
        };

        if (this.panel && this.panel.webview) {
            await this.panel.webview.postMessage({ command: 'updateData', data });
        }
    }

    private getHtmlContent(passwordKey: string): string {
        try {
            const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'profile-info.html');
            const cssPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'profile-info.css');
            const jsPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'profile-info.js');

            // Convert local paths to Webview URIs
            const cssUri = this.panel.webview.asWebviewUri(cssPath);
            const jsUri = this.panel.webview.asWebviewUri(jsPath);
            const nonce = this.getNonce();
            const cspSource = this.panel.webview.cspSource;

            // Content Security Policy
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">`;

            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');

            const profile = this.currentProfileInfo;

            // Render history (server-side rendering due to complexity)
            const historyHtml = this.renderHistory();

            // Inject resource URIs and History HTML
            htmlContent = htmlContent
                .replace('{{CSP_META}}', cspMeta)
                .replace('{{NONCE}}', nonce) // For inline script
                .replace('{{NONCE}}', nonce) // For external script source
                .replace('{{TITLE}}', `Profile: ${profile.fileName}`)
                .replace('{{CSS_URI}}', cssUri.toString())
                .replace('{{JS_URI}}', jsUri.toString())
                .replace('{{HISTORY_CONTENT}}', historyHtml);

            return htmlContent;
        } catch (error) {
            this.outputChannel.appendLine(`[ProfileInfo] Error loading HTML: ${error}`);
            return `<html><body><h1>Error loading profile-info.html</h1><p>${error}</p></body></html>`;
        }
    }

    private getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
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

    private isDeploying(profileName: string): boolean {
        const allHistory = this.historyManager.getAllHistory();
        const latest = allHistory.find(h => h.profileName === profileName);
        return latest?.status === 'in-progress';
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
