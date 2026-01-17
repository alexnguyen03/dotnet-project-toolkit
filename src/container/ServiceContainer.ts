import * as vscode from 'vscode';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { EnvVarPasswordStorage } from '../strategies/EnvVarPasswordStorage';
import { SecretPasswordStorage } from '../strategies/SecretPasswordStorage';
import { IProfileService, ProfileService } from '../services/ProfileService';
import { CommandRegistry } from '../commands/CommandRegistry';
import { DeployProfileCommand } from '../commands/DeployProfileCommand';
import { CreateProfileCommand } from '../commands/CreateProfileCommand';
import { DeleteProfileCommand } from '../commands/DeleteProfileCommand';
import { EditProfileCommand } from '../commands/EditProfileCommand';
import { ProfileInfoCommand } from '../commands/ProfileInfoCommand';
import { RefreshCommand } from '../commands/RefreshCommand';
import { UnifiedTreeProvider } from '../ui/UnifiedTreeProvider';
import { HistoryManager } from '../services/HistoryManager';
import { HistoryTreeProvider } from '../ui/history/HistoryTreeProvider';
import { ProfileInfoPanel } from '../ui/ProfileInfoPanel';

/**
 * Service Container - Dependency Injection
 * Central place to create and wire all dependencies
 */
export class ServiceContainer {
    readonly outputChannel: vscode.OutputChannel;
    readonly passwordStorage: IPasswordStorage;
    readonly profileService: IProfileService;
    readonly treeProvider: UnifiedTreeProvider;
    readonly historyProvider: HistoryTreeProvider;
    readonly historyManager: HistoryManager;
    readonly commandRegistry: CommandRegistry;

    private constructor(context: vscode.ExtensionContext) {
        // Create output channel
        this.outputChannel = vscode.window.createOutputChannel('.NET Toolkit');

        // Get workspace root
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        // Create password storage (use EnvVar by default, can be configured)
        const storageType = vscode.workspace.getConfiguration('dotnetToolkit').get<string>('passwordStorage', 'envvar');

        if (storageType === 'secret') {
            this.passwordStorage = new SecretPasswordStorage(this.outputChannel, context.secrets);
        } else {
            this.passwordStorage = new EnvVarPasswordStorage(this.outputChannel);
        }

        // Create services
        this.profileService = new ProfileService(this.outputChannel, this.passwordStorage);
        this.historyManager = new HistoryManager(context);

        // Create tree providers
        this.treeProvider = new UnifiedTreeProvider(workspaceRoot, this.historyManager);
        this.historyProvider = new HistoryTreeProvider(this.historyManager);

        // Create command registry
        this.commandRegistry = new CommandRegistry(context, this.outputChannel);
    }

    /**
     * Initialize container and register all components
     */
    static initialize(context: vscode.ExtensionContext): ServiceContainer {
        const container = new ServiceContainer(context);

        // Register tree providers
        vscode.window.registerTreeDataProvider('dotnetToolkitExplorer', container.treeProvider);
        vscode.window.registerTreeDataProvider('dotnetHistory', container.historyProvider);

        // Create refresh callback
        const onRefresh = () => {
            container.treeProvider.refresh();
            container.historyProvider.refresh();
            ProfileInfoPanel.currentPanel?.update();
        };

        // Register commands
        container.commandRegistry.registerAll([
            new RefreshCommand(container.outputChannel, onRefresh),
            new DeployProfileCommand(container.outputChannel, onRefresh, container.historyManager),
            new CreateProfileCommand(container.outputChannel, container.profileService, onRefresh),
            new DeleteProfileCommand(container.outputChannel, container.profileService, container.passwordStorage, onRefresh),
            new EditProfileCommand(container.outputChannel, container.profileService, onRefresh),
            new ProfileInfoCommand(container.outputChannel, context.extensionUri, container.profileService, container.passwordStorage, container.historyManager, onRefresh),
        ]);

        // Register History specific commands
        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet-project-toolkit.refreshHistory', () => {
                container.historyProvider.refresh();
                container.outputChannel.appendLine('[History] Manually refreshed deployment history');
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet-project-toolkit.clearHistory', async () => {
                const answer = await vscode.window.showWarningMessage(
                    'Are you sure you want to clear all deployment history?',
                    { modal: true },
                    'Clear All',
                    'Cancel'
                );

                if (answer === 'Clear All') {
                    await container.historyManager.clearHistory();
                    container.historyProvider.refresh();
                    vscode.window.showInformationMessage('Deployment history cleared');
                }
            })
        );

        context.subscriptions.push(
            vscode.commands.registerCommand('dotnet-project-toolkit.clearHistoryEntry', async (item: any) => {
                if (item && item.record && item.record.id) {
                    await container.historyManager.clearEntry(item.record.id);
                    container.historyProvider.refresh();
                }
            })
        );

        container.outputChannel.appendLine('[Container] All services initialized');

        return container;
    }
}
