import * as vscode from 'vscode';
import { ICommand } from './ICommand';
import { PublishTreeItem } from '../ui/publish/PublishTreeProvider';
import { HistoryManager } from '../services/HistoryManager';
import { PublishProfileInfo, DeployEnvironment } from '../models/ProjectModels';
import { IDeploymentService } from '../services/DeploymentService';

/**
 * Deploy Profile Command
 * Handles deploying to a publish profile
 */
export class DeployProfileCommand implements ICommand {
    readonly id = 'dotnet-project-toolkit.deployProfile';

    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly onRefresh: () => void,
        private readonly historyManager: HistoryManager,
        private readonly deploymentService: IDeploymentService
    ) { }

    async execute(item: PublishTreeItem): Promise<void> {
        // Debug: Log what we received
        this.outputChannel.appendLine('=== DeployProfileCommand.execute ===');
        this.outputChannel.appendLine(`[Deploy] Received item type: ${item?.constructor?.name || 'unknown'}`);
        this.outputChannel.appendLine(`[Deploy] item.contextValue: ${item?.contextValue}`);
        this.outputChannel.appendLine(`[Deploy] item.label: ${item?.label}`);
        this.outputChannel.appendLine(`[Deploy] item.projectName: ${item?.projectName}`);
        this.outputChannel.appendLine(`[Deploy] item.projectInfo: ${!!item?.projectInfo}`);
        this.outputChannel.appendLine(`[Deploy] item.profileInfo: ${!!item?.profileInfo}`);
        this.outputChannel.appendLine(`[Deploy] item.csprojPath: ${item?.csprojPath || 'undefined'}`);
        this.outputChannel.appendLine(`[Deploy] item.projectPath (getter): ${item?.projectPath || 'undefined'}`);
        
        // Log all properties
        if (item) {
            this.outputChannel.appendLine(`[Deploy] All item properties: ${JSON.stringify(Object.keys(item))}`);
        }
        
        if (!item || !item.profileInfo) {
            vscode.window.showErrorMessage('No publish profile selected');
            return;
        }

        const profile = item.profileInfo;
        const projectName = item.projectName || 'Unknown Project';
        const environment = profile.environment.toUpperCase();

        // CRITICAL FIX: VS Code serializes tree items, losing csprojPath
        // Derive csproj path from pubxml path
        // pubxml: D:\...\Properties\PublishProfiles\staging.pubxml
        // csproj: D:\...\ProjectName.csproj
        let projectPath = item.projectPath || item.csprojPath;
        
        if (!projectPath && profile.path) {
            // Extract from pubxml path
            // Remove: \Properties\PublishProfiles\{profile}.pubxml
            const pubxmlPath = profile.path;
            const projectDir = pubxmlPath.replace(/[\\\/]Properties[\\\/]PublishProfiles[\\\/][^\\\/]+\.pubxml$/i, '');
            
            // Try to find .csproj in project directory
            const fs = require('fs');
            const path = require('path');
            
            try {
                if (fs.existsSync(projectDir)) {
                    const files = fs.readdirSync(projectDir);
                    const csprojFile = files.find((f: string) => f.endsWith('.csproj'));
                    
                    if (csprojFile) {
                        projectPath = path.join(projectDir, csprojFile);
                        this.outputChannel.appendLine(`[Deploy] Derived project path from pubxml: ${projectPath}`);
                    }
                }
            } catch (error) {
                this.outputChannel.appendLine(`[Deploy] Error deriving project path: ${error}`);
            }
        }
        
        this.outputChannel.appendLine(`[Deploy] Final project path: ${projectPath || 'NOT FOUND'}`);

        // 1. Confirm deployment (for ALL environments)
        const isProd = profile.environment === DeployEnvironment.Production;
        const confirmMessage = isProd
            ? `⚠️ Deploy to PRODUCTION environment with profile: ${profile.name}?`
            : `Deploy to ${environment} environment with profile: ${profile.name}?`;

        const confirm = await vscode.window.showWarningMessage(
            confirmMessage,
            { modal: true },
            'Deploy',
            'Cancel'
        );

        if (confirm !== 'Deploy') {
            return;
        }

        // 2. Add history record (in-progress)
        const startTime = new Date();
        const historyId = await this.historyManager.addDeployment({
            profileName: profile.fileName, // Use fileName for consistent ID
            projectName: projectName,
            environment: environment,
            status: 'in-progress',
            startTime: startTime.toISOString()
        }, profile.path);

        // Refresh views to show in-progress
        this.onRefresh();

        // 3. Start real deployment process
        try {
            let deploymentResult: any;

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Deploying ${profile.name}...`,
                cancellable: false
            }, async (progress) => {
                this.outputChannel.appendLine(`[Deploy] Starting deployment for ${profile.name} (${environment})`);
                this.outputChannel.appendLine(`[Deploy] Project: ${projectName}`);
                this.outputChannel.appendLine(`[Deploy] Profile Path: ${profile.path}`);
                this.outputChannel.appendLine(`[Deploy] Using Project Path: ${projectPath || 'NOT FOUND'}`);
                
                if (!projectPath) {
                    throw new Error('Project path not found. Cannot deploy without .csproj path.');
                }
                
                this.outputChannel.show();

                // Execute real deployment
                deploymentResult = await this.deploymentService.deploy(
                    projectPath,
                    projectName,
                    profile,
                    (message, increment) => {
                        progress.report({ message, increment });
                    }
                );
            });

            // Check deployment result
            if (!deploymentResult.success) {
                throw new Error(deploymentResult.errorMessage || 'Deployment failed');
            }

            // 4. Update history with success
            const endTime = new Date();
            await this.historyManager.updateDeployment(historyId, {
                status: 'success',
                endTime: endTime.toISOString(),
                duration: endTime.getTime() - startTime.getTime()
            }, profile.path);

            // 5. Open browser if enabled and URL is available
            const config = vscode.workspace.getConfiguration('dotnetToolkit');
            const globalOpenBrowser = config.get<boolean>('openBrowserOnDeploy', true);
            const openBrowser = profile.openBrowserOnDeploy ?? globalOpenBrowser;
            
            if (openBrowser && profile.siteUrl) {
                this.outputChannel.appendLine(`[Browser] Opening site: ${profile.siteUrl}`);
                try {
                    await vscode.env.openExternal(vscode.Uri.parse(profile.siteUrl));
                    vscode.window.showInformationMessage(`✅ ${profile.name} deployed. Opened ${profile.siteUrl}`);
                    this.outputChannel.appendLine(`[Browser] Opened: ${profile.siteUrl}`);
                } catch (err) {
                    this.outputChannel.appendLine(`[Browser] Failed to open: ${err}`);
                    vscode.window.showInformationMessage(`✅ ${profile.name} deployed successfully!`);
                }
            } else {
                if (openBrowser && !profile.siteUrl) {
                    this.outputChannel.appendLine(`[Browser] No site URL configured for this profile`);
                }
                vscode.window.showInformationMessage(`✅ ${profile.name} deployed successfully!`);
            }

        } catch (error: any) {
            // 5. Update history with failure
            const endTime = new Date();
            await this.historyManager.updateDeployment(historyId, {
                status: 'failed',
                endTime: endTime.toISOString(),
                duration: endTime.getTime() - startTime.getTime(),
                errorMessage: error.message || 'Unknown error occurred during deployment'
            }, profile.path);

            vscode.window.showErrorMessage(`❌ Deployment failed: ${error.message}`);
            this.outputChannel.appendLine(`[Error] Deployment failed: ${error.message}`);
        } finally {
            this.onRefresh();
        }
    }
}
