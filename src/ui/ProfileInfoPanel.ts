import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PublishProfileInfo, ProjectInfo, DeployEnvironment } from '../models/ProjectModels';
import { IProfileService, ProfileWizardData } from '../services/ProfileService';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { HistoryManager } from '../services/HistoryManager';
import { DeploymentRecordHelper } from '../models/DeploymentRecord';
import { ConnectionTester } from '../utils/ConnectionTester';

/**
 * Profile Info Webview Panel
 * Shows profile details and allows editing
 */
export class ProfileInfoPanel {
	// Map to store active panels: key -> panel
	private static panels: Map<string, ProfileInfoPanel> = new Map();

	/**
	 * Update all active panels
	 */
	public static updateAll() {
		this.panels.forEach((panel) => panel.update());
	}

	private readonly panel: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];

	// Store mutable state
	private currentProfileInfo: PublishProfileInfo;
	private currentProjectName: string;
	private isCreateMode: boolean = false;
	private projectInfo?: ProjectInfo;
	private panelKey: string;

	private constructor(
		panel: vscode.WebviewPanel,
		public readonly extensionUri: vscode.Uri,
		profileInfo: PublishProfileInfo,
		projectName: string,
		private readonly profileService: IProfileService,
		private readonly passwordStorage: IPasswordStorage,
		private readonly historyManager: HistoryManager,
		private readonly outputChannel: vscode.OutputChannel,
		private readonly onRefresh: () => void,
		key: string,
		isCreateMode: boolean = false,
		projectInfo?: ProjectInfo
	) {
		this.panel = panel;
		this.currentProfileInfo = profileInfo;
		this.currentProjectName = projectName;
		this.panelKey = key;
		this.isCreateMode = isCreateMode;
		this.projectInfo = projectInfo;

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
						if (this.currentProfileInfo.path) {
							const uri = vscode.Uri.file(this.currentProfileInfo.path);
							await vscode.window.showTextDocument(uri, { preview: false });
						}
						break;
					case 'deploy':
						// 1. Notify UI: Deployment Starting (Loading State)
						// We manually force isDeploying: true here because the history record might not be written yet
						// or we want immediate feedback before the command starts.
						this._isDeploying = true;
						// Send update with override for faster feedback, though next update() calls get it from _isDeploying
						await this.sendUpdateData({ isDeploying: true });
						await this.sendHistoryUpdate();

						// 2. Execute Deployment
						await vscode.commands.executeCommand(
							'dotnet-project-toolkit.deployProfile',
							{
								profileInfo: this.currentProfileInfo,
								projectName: this.currentProjectName,
							}
						);

						// 3. Notify UI: Deployment Finished & Refresh History
						this._isDeploying = false;
						await this.sendUpdateData({ isDeploying: false });
						await this.sendHistoryUpdate();
						break;
					case 'delete':
						await vscode.commands.executeCommand(
							'dotnet-project-toolkit.deletePublishProfile',
							{
								profileInfo: this.currentProfileInfo,
								projectName: this.currentProjectName,
							}
						);
						// Close panel if file was deleted
						if (!fs.existsSync(this.currentProfileInfo.path)) {
							this.panel.dispose();
						}
						break;
					case 'viewLogs':
						await vscode.commands.executeCommand('dotnet-project-toolkit.viewLogs', {
							profileInfo: this.currentProfileInfo,
							projectName: this.currentProjectName,
						});
						break;
					case 'ready':
						await this.sendUpdateData();
						break;
					case 'testConnection':
						await this.handleTestConnection(message.data);
						break;
					case 'clone':
						await this.handleCloneProfile(message.data);
						break;
				}
			},
			null,
			this.disposables
		);

		// Handle disposal
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
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

		// Generate unique key for this profile view
		const key = `view:${projectName}:${profileInfo.fileName}`;

		// If panel exists, reveal it
		if (ProfileInfoPanel.panels.has(key)) {
			ProfileInfoPanel.panels.get(key)?.panel.reveal(column);
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
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			}
		);

		const instance = new ProfileInfoPanel(
			panel,
			extensionUri,
			profileInfo,
			projectName,
			profileService,
			passwordStorage,
			historyManager,
			outputChannel,
			onRefresh,
			key
		);

		ProfileInfoPanel.panels.set(key, instance);
	}

	/**
	 * Show panel for creating a new profile
	 */
	public static showForCreate(
		extensionUri: vscode.Uri,
		projectInfo: ProjectInfo,
		profileName: string,
		environment: DeployEnvironment,
		profileService: IProfileService,
		passwordStorage: IPasswordStorage,
		historyManager: HistoryManager,
		outputChannel: vscode.OutputChannel,
		onRefresh: () => void
	) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		// Generate unique key for creation
		const key = `create:${projectInfo.name}:${profileName}`;

		// If panel exists for this creation attempt, reveal it
		if (ProfileInfoPanel.panels.has(key)) {
			ProfileInfoPanel.panels.get(key)?.panel.reveal(column);
			return;
		}

		// Create new panel
		const panel = vscode.window.createWebviewPanel(
			'profileInfo',
			`New Profile: ${profileName}`,
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
			}
		);

		// Create empty profile info for the form
		const emptyProfileInfo: PublishProfileInfo = {
			name: profileName,
			path: '', // Will be set when saved
			fileName: profileName,
			environment: environment,
			isProduction: environment === DeployEnvironment.Production,
			publishUrl: '',
			siteName: '',
			siteUrl: '',
			userName: '',
			openBrowserOnDeploy: true,
			enableStdoutLog: false,
			logPath: '',
		};

		const instance = new ProfileInfoPanel(
			panel,
			extensionUri,
			emptyProfileInfo,
			projectInfo.name,
			profileService,
			passwordStorage,
			historyManager,
			outputChannel,
			onRefresh,
			key,
			true, // isCreateMode
			projectInfo
		);

		ProfileInfoPanel.panels.set(key, instance);
	}

	private _isDeploying: boolean = false;

	private async saveProfile(data: ProfileWizardData) {
		try {
			this.outputChannel.appendLine(`[ProfileInfo] Saving: ${data.profileName}`);

			// Get project info
			let projectInfo: ProjectInfo;
			if (this.isCreateMode && this.projectInfo) {
				projectInfo = this.projectInfo;
			} else {
				projectInfo = {
					name: this.currentProjectName,
					projectDir: this.currentProfileInfo.path.replace(
						/[\\\/]Properties[\\\/]PublishProfiles[\\\/][^\\\/]+$/i,
						''
					),
					csprojPath: '',
					projectType: 'unknown',
					profiles: [],
				};
			}

			// Save profile (create or update)
			const profilePath = await this.profileService.create(
				projectInfo,
				data,
				!this.isCreateMode
			);

			if (profilePath) {
				// Save password if provided
				if (data.password && data.password !== 'KEEP_EXISTING') {
					const passwordKey = this.passwordStorage.generateKey(
						this.currentProjectName,
						data.profileName
					);
					await this.passwordStorage.store(passwordKey, data.password);
				}

				const message = this.isCreateMode
					? `✅ Profile "${data.profileName}" created successfully!`
					: `✅ Profile "${data.profileName}" saved!`;
				vscode.window.setStatusBarMessage(message, 5000);

				// Reload profile info from disk
				// Update current profile info with saved data immediately to ensure UI consistency
				// (Parsing from disk might have delays or potential issues, so we trust the input data for now)
				this.currentProfileInfo = {
					name: data.profileName,
					path: profilePath,
					fileName: data.profileName,
					environment: data.environment,
					isProduction: data.environment === DeployEnvironment.Production,
					publishUrl: data.publishUrl,
					siteName: data.siteName,
					siteUrl: data.siteUrl || '',
					userName: data.username,
					openBrowserOnDeploy: data.openBrowserOnDeploy,
					enableStdoutLog: data.enableStdoutLog,
					logPath: data.logPath,
				};

				this.panel.title = `${this.currentProjectName} / ${this.currentProfileInfo.fileName}`;
				this.isCreateMode = false; // Switch to edit mode after first save

				this.onRefresh();
				this.update(); // Re-render webview with new data
				this.outputChannel.appendLine(`[ProfileInfo] ✓ Saved successfully`);
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to save: ${error}`);
			this.outputChannel.appendLine(`[ProfileInfo] Error: ${error}`);
		}
	}

	public update() {
		const passwordKey = this.passwordStorage.generateKey(
			this.currentProjectName,
			this.currentProfileInfo.fileName
		);

		this.panel.webview.html = this.getHtmlContent(passwordKey);
		// Also send data update in case webview is already loaded
		this.sendUpdateData();
	}

	private async sendUpdateData(overrides: Partial<any> = {}) {
		const passwordKey = this.passwordStorage.generateKey(
			this.currentProjectName,
			this.currentProfileInfo.fileName
		);
		const profile = this.currentProfileInfo;

		const baseData = {
			projectName: this.currentProjectName,
			profileFileName: profile.fileName,
			environment: profile.environment,
			publishUrl: profile.publishUrl,
			siteName: profile.siteName,
			siteUrl: profile.siteUrl,
			username: profile.userName,
			openBrowserOnDeploy: profile.openBrowserOnDeploy,
			enableStdoutLog: profile.enableStdoutLog,
			logPath: profile.logPath,
			passwordKey: passwordKey,
			isDeploying: this._isDeploying || this.isDeploying(profile.fileName),
			isCreateMode: this.isCreateMode,
		};

		const data = { ...baseData, ...overrides };

		if (this.panel && this.panel.webview) {
			await this.panel.webview.postMessage({ command: 'updateData', data });
		}
	}

	private async sendHistoryUpdate() {
		if (this.panel && this.panel.webview) {
			const historyHtml = this.renderHistory();
			await this.panel.webview.postMessage({
				command: 'updateHistory',
				html: historyHtml,
			});
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
			.filter((h) => h.profileName === this.currentProfileInfo.fileName)
			.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()); // Ensure desc order

		// Prepend fake 'in-progress' item if locally deploying and not yet in history
		let displayItems = [...profileHistory];
		if (this._isDeploying) {
			const alreadyInProgress =
				displayItems.length > 0 && displayItems[0].status === 'in-progress';
			if (!alreadyInProgress) {
				displayItems.unshift({
					id: 'temp-pending',
					profileName: this.currentProfileInfo.fileName,
					status: 'in-progress',
					startTime: new Date().toISOString(),
					duration: 0,
					projectName: this.currentProjectName,
					environment: this.currentProfileInfo.environment,
				});
			}
		}

		displayItems = displayItems.slice(0, 5); // Show last 5 entries

		if (displayItems.length === 0) {
			return `
                <div class="history-placeholder">
                    <p>No publish history available yet.</p>
                    <small>History will be recorded when you deploy using this profile.</small>
                </div>`;
		}

		const items = displayItems
			.map((h) => {
				const isInProgress = h.status === 'in-progress';
				const statusIcon =
					h.status === 'success'
						? '✅'
						: h.status === 'failed'
							? '❌'
							: '<div class="spinner"></div>';
				const duration = h.duration
					? DeploymentRecordHelper.formatDuration(h.duration)
					: '';
				const startTime = new Date(h.startTime).toLocaleString();
				const statusText = isInProgress ? 'DEPLOYING...' : h.status.toUpperCase();

				return `
                <div class="history-item ${h.status}">
                    <div class="history-info">
                        <div class="history-status">${statusIcon} ${statusText}</div>
                        <div class="history-time">${startTime}</div>
                    </div>
                    <div class="history-duration">${duration}</div>
                </div>`;
			})
			.join('');

		return `<div class="history-list">${items}</div>`;
	}

	private isDeploying(profileName: string): boolean {
		const allHistory = this.historyManager.getAllHistory();
		const latest = allHistory.find((h) => h.profileName === profileName);
		return latest?.status === 'in-progress';
	}

	private async handleTestConnection(data: any): Promise<void> {
		this.outputChannel.appendLine(`[ProfileInfo] Testing connection for ${data.profileName}`);

		// Create a temporary profile object from form data
		const tempProfile: PublishProfileInfo = {
			name: data.profileName,
			path: this.currentProfileInfo.path,
			fileName: data.profileName,
			environment: data.environment as DeployEnvironment,
			isProduction: data.environment === DeployEnvironment.Production,
			publishUrl: data.publishUrl,
			siteName: data.siteName,
			siteUrl: data.siteUrl,
			userName: data.username,
			openBrowserOnDeploy: data.openBrowserOnDeploy,
			enableStdoutLog: data.enableStdoutLog,
			logPath: data.logPath,
			// Infer method from current profile or guess. Usually it's in the profile file.
			// The form doesn't actually allow changing the method (MSDeploy vs FileSystem).
			// We should use the method from the saved profile, as the UI doesn't expose it.
			publishMethod: this.currentProfileInfo.publishMethod
		};

		// If the user changed the URL, we might want to guess the method if it's not set
		// But simpler to rely on existing method. 

		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: `Testing connection to ${data.profileName}...`,
				cancellable: false,
			},
			async () => {
				const result = await ConnectionTester.testConnection(tempProfile, this.outputChannel);
				if (result.success) {
					vscode.window.showInformationMessage(`✅ Connection successful: ${result.message}`);
				} else {
					vscode.window.showErrorMessage(`❌ Connection failed: ${result.message}`);
				}
			}
		);
	}

	private async handleCloneProfile(data: any): Promise<void> {
		const targetEnv = data.targetEnvironment as DeployEnvironment;
		const currentEnv = this.currentProfileInfo.environment;

		// 1. Calculate new Name
		let newName = this.currentProfileInfo.fileName;

		const envKeywords: Record<string, string> = {
			'dev': 'Dev',
			'staging': 'Staging',
			'uat': 'UAT',
			'production': 'Prod',
			'prod': 'Prod'
		};

		// Try to replace environment keyword in the name
		// We use the enum values (dev, staging, production) as keys
		// And also common variations

		const currentKeyword = envKeywords[currentEnv] || currentEnv;
		const targetKeyword = envKeywords[targetEnv] || targetEnv;

		let nameChanged = false;

		// Try replacing exact environment string (case insensitive)
		const envRegex = new RegExp(currentEnv, 'i');
		if (envRegex.test(newName)) {
			newName = newName.replace(envRegex, targetEnv); // Replace with raw enum value first? Or keyword?
			// Let's use the same casing convention if possible, but fallback to enum value
			// Actually better to use the targetKeyword (PascalCase usually preferred in filenames)
			newName = newName.replace(envRegex, targetKeyword);
			nameChanged = true;
		} else {
			// Try replacing the keyword (e.g. they named it "MyApi_Prod" but env is "production")
			const keywordRegex = new RegExp(currentKeyword, 'i');
			if (keywordRegex.test(newName)) {
				newName = newName.replace(keywordRegex, targetKeyword);
				nameChanged = true;
			}
		}

		if (!nameChanged) {
			// Fallback: append environment
			newName = `${newName}_${targetKeyword}`;
		}

		// 2. Prepare Project Info
		let projectInfo: ProjectInfo;
		if (this.projectInfo) {
			projectInfo = this.projectInfo;
		} else {
			// Reconstruct minimal project info from current profile path
			// Assuming standard structure: ProjectDir\Properties\PublishProfiles\Profile.pubxml
			const projectDir = this.currentProfileInfo.path
				? path.dirname(path.dirname(path.dirname(this.currentProfileInfo.path)))
				: ''; // Approximate

			projectInfo = {
				name: this.currentProjectName,
				projectDir: projectDir,
				csprojPath: '', // Unknown, but ProfileService might handle it or not need it for creation if only path is used
				projectType: 'unknown',
				profiles: [],
			};
		}

		this.outputChannel.appendLine(`[ProfileInfo] Cloning profile "${this.currentProfileInfo.fileName}" to "${newName}" (${targetEnv})`);

		// 3. Open Create Wizard
		ProfileInfoPanel.showForCreate(
			this.extensionUri,
			projectInfo,
			newName,
			targetEnv,
			this.profileService,
			this.passwordStorage,
			this.historyManager,
			this.outputChannel,
			this.onRefresh
		);

		// 4. Pre-fill data in the new panel
		// We need to wait a brief moment for the panel to be registered in the map
		setTimeout(() => {
			const newKey = `create:${projectInfo.name}:${newName}`;
			const newPanel = ProfileInfoPanel.panels.get(newKey);

			if (newPanel) {
				// Inject current data
				newPanel.currentProfileInfo = {
					...newPanel.currentProfileInfo,
					publishUrl: this.currentProfileInfo.publishUrl,
					userName: this.currentProfileInfo.userName,
					openBrowserOnDeploy: this.currentProfileInfo.openBrowserOnDeploy,
					enableStdoutLog: this.currentProfileInfo.enableStdoutLog,
					logPath: this.currentProfileInfo.logPath
				};

				// Handle Site Name replacement
				if (this.currentProfileInfo.siteName) {
					let newSiteName = this.currentProfileInfo.siteName;
					const envRegex = new RegExp(currentEnv, 'i');
					const keywordRegex = new RegExp(currentKeyword, 'i');

					if (envRegex.test(newSiteName)) {
						newSiteName = newSiteName.replace(envRegex, targetKeyword.toUpperCase()); // Site names often uppercase
					} else if (keywordRegex.test(newSiteName)) {
						newSiteName = newSiteName.replace(keywordRegex, targetKeyword.toUpperCase());
					}
					newPanel.currentProfileInfo.siteName = newSiteName;
				}

				// Handle Site URL replacement
				if (this.currentProfileInfo.siteUrl) {
					// URL replacements are tricky, usually lowercase
					let newSiteUrl = this.currentProfileInfo.siteUrl;
					// Try simple replacement
					if (newSiteUrl.toLowerCase().includes(currentEnv.toLowerCase())) {
						newSiteUrl = newSiteUrl.replace(new RegExp(currentEnv, 'i'), targetEnv.toLowerCase());
					}
					// If contains keyword
					if (newSiteUrl.toLowerCase().includes(currentKeyword.toLowerCase())) {
						newSiteUrl = newSiteUrl.replace(new RegExp(currentKeyword, 'i'), targetKeyword.toLowerCase());
					}
					newPanel.currentProfileInfo.siteUrl = newSiteUrl;
				}

				// Update the UI
				newPanel.update();

				vscode.window.showInformationMessage(`📋 Cloned to new profile: ${newName}`);
			}
		}, 500);
	}

	public dispose() {
		ProfileInfoPanel.panels.delete(this.panelKey);
		this.panel.dispose();
		while (this.disposables.length) {
			const d = this.disposables.pop();
			if (d) d.dispose();
		}
	}
}
