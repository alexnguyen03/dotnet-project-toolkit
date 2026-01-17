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

/**
 * Service Container - Dependency Injection
 * Central place to create and wire all dependencies
 */
export class ServiceContainer {
    readonly outputChannel: vscode.OutputChannel;
    readonly passwordStorage: IPasswordStorage;
    readonly profileService: IProfileService;
    readonly treeProvider: UnifiedTreeProvider;
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

        // Create tree provider
        this.treeProvider = new UnifiedTreeProvider(workspaceRoot);

        // Create command registry
        this.commandRegistry = new CommandRegistry(context, this.outputChannel);
    }

    /**
     * Initialize container and register all components
     */
    static initialize(context: vscode.ExtensionContext): ServiceContainer {
        const container = new ServiceContainer(context);

        // Register tree provider
        vscode.window.registerTreeDataProvider('dotnetToolkitExplorer', container.treeProvider);

        // Create refresh callback
        const onRefresh = () => container.treeProvider.refresh();

        // Register commands
        container.commandRegistry.registerAll([
            new RefreshCommand(container.outputChannel, onRefresh),
            new DeployProfileCommand(container.outputChannel, onRefresh),
            new CreateProfileCommand(container.outputChannel, context.extensionUri, container.profileService, container.passwordStorage, onRefresh),
            new DeleteProfileCommand(container.outputChannel, container.profileService, container.passwordStorage, onRefresh),
            new EditProfileCommand(container.outputChannel, container.profileService, onRefresh),
            new ProfileInfoCommand(container.outputChannel, context.extensionUri, container.profileService, container.passwordStorage, onRefresh),
        ]);

        container.outputChannel.appendLine('[Container] All services initialized');
        
        return container;
    }
}
