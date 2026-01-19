import * as vscode from 'vscode';
import { IPasswordStorage } from '../strategies/IPasswordStorage';
import { EnvVarPasswordStorage } from '../strategies/EnvVarPasswordStorage';
import { SecretPasswordStorage } from '../strategies/SecretPasswordStorage';
import { IProfileService, ProfileService } from '../services/ProfileService';
import { IDeploymentService, DeploymentService } from '../services/DeploymentService';
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
import { WatchService } from '../services/WatchService';
import { WatchConfigService } from '../services/WatchConfigService';
import { WatchTreeProvider } from '../ui/WatchTreeProvider';
import { ProjectScanner } from '../utils/ProjectScanner';
import { DebugService } from '../services/DebugService';
import { DebugConfigService } from '../services/DebugConfigService';
import { DebugTreeProvider } from '../ui/debug/DebugTreeProvider';
import { PublishTreeProvider } from '../ui/publish/PublishTreeProvider';

// Import new abstractions
import { ConfigurationService } from '../services/ConfigurationService';
import { FileSystemRepository } from '../repositories/FileSystemRepository';
import { FastXmlParser } from '../parsers/FastXmlParser';
import { ProjectAnalyzer } from '../analyzers/ProjectAnalyzer';
import { ProfileXmlGenerator } from '../generators/ProfileXmlGenerator';
import { ProfileRepository } from '../repositories/ProfileRepository';
import { EnvironmentDetector } from '../detectors/EnvironmentDetector';

/**
 * Service Container - Dependency Injection
 * Central place to create and wire all dependencies
 * Refactored to use new abstraction layers
 */
export class ServiceContainer {
	readonly outputChannel: vscode.OutputChannel;
	readonly configService: ConfigurationService;
	readonly fileSystem: FileSystemRepository;
	readonly xmlParser: FastXmlParser;
	readonly passwordStorage: IPasswordStorage;
	readonly profileService: IProfileService;
	readonly deploymentService: IDeploymentService;
	readonly treeProvider: UnifiedTreeProvider;
	readonly historyProvider: HistoryTreeProvider;
	readonly historyManager: HistoryManager;
	readonly commandRegistry: CommandRegistry;
	readonly watchService: WatchService;
	readonly watchConfigService: WatchConfigService;
	readonly watchTreeProvider: WatchTreeProvider;
	readonly projectScanner: ProjectScanner;
	readonly debugService: DebugService;
	readonly debugConfigService: DebugConfigService;
	readonly debugTreeProvider: DebugTreeProvider;
	readonly publishTreeProvider: PublishTreeProvider;
	readonly logViewerService: any; // Will be typed properly

	private constructor(context: vscode.ExtensionContext) {
		// Create output channel
		this.outputChannel = vscode.window.createOutputChannel('.NET Toolkit');

		// Create infrastructure services
		this.configService = new ConfigurationService();
		this.fileSystem = new FileSystemRepository();
		this.xmlParser = new FastXmlParser();

		// Get workspace root
		const workspaceRoot = this.configService.getWorkspaceRoot() || '';

		// Create password storage (use configuration service)
		const storageType = this.configService.getPasswordStorageType();

		if (storageType === 'envvar') {
			this.passwordStorage = new EnvVarPasswordStorage(this.outputChannel);
		} else {
			// Default to SecretStorage (encrypted, secure)
			this.passwordStorage = new SecretPasswordStorage(this.outputChannel, context.secrets);
		}

		// Create specialized services for ProfileService
		const environmentDetector = new EnvironmentDetector();
		const projectAnalyzer = new ProjectAnalyzer(this.xmlParser, this.fileSystem);
		const profileXmlGenerator = new ProfileXmlGenerator();
		const profileRepository = new ProfileRepository(this.fileSystem);

		// Create ProfileService with all dependencies
		this.profileService = new ProfileService(
			this.xmlParser,
			this.fileSystem,
			projectAnalyzer,
			profileXmlGenerator,
			profileRepository,
			environmentDetector,
			this.passwordStorage,
			this.outputChannel
		);

		// Create WebConfigModifier
		const webConfigModifier = new (require('../services/WebConfigModifier').WebConfigModifier)(
			this.outputChannel
		);

		// Create LogViewerService
		this.logViewerService = new (require('../services/LogViewerService').LogViewerService)(
			this.outputChannel
		);

		// Create other services
		this.deploymentService = new DeploymentService(
			this.outputChannel,
			this.passwordStorage,
			webConfigModifier
		);
		this.historyManager = new HistoryManager(context);
		this.projectScanner = new ProjectScanner();
		this.watchConfigService = new WatchConfigService(context);
		this.watchService = new WatchService(context);
		this.debugConfigService = new DebugConfigService(context);
		this.debugService = new DebugService(context);

		// Create tree providers
		this.historyProvider = new HistoryTreeProvider(this.historyManager);
		this.watchTreeProvider = new WatchTreeProvider(
			this.watchService,
			this.watchConfigService,
			this.projectScanner,
			workspaceRoot
		);
		this.debugTreeProvider = new DebugTreeProvider(
			this.debugService,
			this.debugConfigService,
			this.projectScanner,
			workspaceRoot
		);
		this.publishTreeProvider = new PublishTreeProvider(workspaceRoot);
		this.treeProvider = new UnifiedTreeProvider(
			workspaceRoot,
			this.historyManager,
			this.watchTreeProvider,
			this.debugTreeProvider
		);

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
		vscode.window.registerTreeDataProvider('dotnetWatch', container.watchTreeProvider);
		vscode.window.registerTreeDataProvider('dotnetDebug', container.debugTreeProvider);
		vscode.window.registerTreeDataProvider('dotnetPublish', container.publishTreeProvider);

		// Create refresh callback
		const onRefresh = () => {
			container.treeProvider.refresh();
			container.historyProvider.refresh();
			container.watchTreeProvider.refresh();
			container.publishTreeProvider.refresh();
			ProfileInfoPanel.updateAll();
		};

		// Register commands
		container.commandRegistry.registerAll([
			new RefreshCommand(container.outputChannel, onRefresh),
			new DeployProfileCommand(
				container.outputChannel,
				onRefresh,
				container.historyManager,
				container.deploymentService
			),
			new CreateProfileCommand(container.outputChannel, container.profileService, onRefresh),
			new DeleteProfileCommand(
				container.outputChannel,
				container.profileService,
				container.passwordStorage,
				onRefresh
			),
			new EditProfileCommand(container.outputChannel, container.profileService, onRefresh),
			new ProfileInfoCommand(
				container.outputChannel,
				context.extensionUri,
				container.profileService,
				container.passwordStorage,
				container.historyManager,
				onRefresh
			),
		]);

		// Register View Logs command
		context.subscriptions.push(
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.viewLogs',
				async (args: any) => {
					if (args && args.profileInfo && args.projectName) {
						try {
							// Get password from storage
							const passwordKey = container.passwordStorage.generateKey(
								args.projectName,
								args.profileInfo.fileName
							);
							const password = await container.passwordStorage.retrieve(passwordKey);

							if (!password) {
								vscode.window.showWarningMessage(
									'Password not found. Please configure credentials first.'
								);
								return;
							}

							// Fetch and display logs
							await container.logViewerService.viewLogs(args.profileInfo, password);
						} catch (error: any) {
							vscode.window.showErrorMessage(`Failed to view logs: ${error.message}`);
						}
					}
				}
			)
		);

		// Register History specific commands
		context.subscriptions.push(
			vscode.commands.registerCommand('dotnet-project-toolkit.refreshHistory', () => {
				container.historyProvider.refresh();
				container.outputChannel.appendLine(
					'[History] Manually refreshed deployment history'
				);
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
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.clearHistoryEntry',
				async (item: any) => {
					if (item && item.record && item.record.id) {
						await container.historyManager.clearEntry(item.record.id);
						container.historyProvider.refresh();
					}
				}
			)
		);

		// Register Watch specific commands
		context.subscriptions.push(
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.watch.start',
				async (item: any) => {
					if (item && item.project) {
						await container.watchService.runWatch(item.project);
						container.watchTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand('dotnet-project-toolkit.watch.stop', (item: any) => {
				const csprojPath = item?.csprojPath || item?.project?.csprojPath;
				if (csprojPath) {
					container.watchService.stopWatch(csprojPath);
					container.watchTreeProvider.refresh();
				}
			}),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.watch.runGroup',
				async (item: any) => {
					if (item && item.group) {
						const structure = await container.projectScanner.scanWorkspace(
							vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
						);
						await container.watchService.runGroup(item.group, structure.projects);
						container.watchTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand('dotnet-project-toolkit.watch.stopAll', () => {
				container.watchService.stopAll();
				container.watchTreeProvider.refresh();
			}),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.watch.stopGroup',
				async (item: any) => {
					if (item && item.group) {
						const structure = await container.projectScanner.scanWorkspace(
							vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
						);
						container.watchService.stopGroup(item.group, structure.projects);
						container.watchTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.watch.createGroup',
				async () => {
					const name = await vscode.window.showInputBox({
						prompt: 'Enter Watch Group Name',
						placeHolder: 'Frontend & Backend',
					});
					if (!name) return;

					const structure = await container.projectScanner.scanWorkspace(
						vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
					);
					if (structure.projects.length === 0) {
						vscode.window.showWarningMessage('No projects found to group.');
						return;
					}

					const projectPicks = structure.projects.map((p) => ({
						label: p.name,
						description: vscode.workspace.asRelativePath(p.projectDir),
						project: p,
					}));

					const selected = await vscode.window.showQuickPick(projectPicks, {
						canPickMany: true,
						placeHolder: 'Select projects to include in this group',
					});

					if (selected && selected.length > 0) {
						await container.watchConfigService.saveGroup({
							id: container.watchConfigService.generateId(),
							name: name,
							projects: selected.map((s) => s.project.name),
						});
						container.watchTreeProvider.refresh();
						vscode.window.showInformationMessage(`Watch group '${name}' created!`);
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.watch.deleteGroup',
				async (item: any) => {
					if (item && item.group) {
						const confirm = await vscode.window.showWarningMessage(
							`Delete watch group '${item.group.name}'?`,
							{ modal: true },
							'Delete'
						);
						if (confirm === 'Delete') {
							await container.watchConfigService.deleteGroup(item.group.id);
							container.watchTreeProvider.refresh();
						}
					}
				}
			)
		);

		// Register Debug specific commands
		context.subscriptions.push(
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.start',
				async (item: any) => {
					if (item && item.project) {
						await container.debugService.startDebugging(item.project);
						container.debugTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.stop',
				async (item: any) => {
					const csprojPath = item?.csprojPath || item?.project?.csprojPath;
					if (csprojPath) {
						await container.debugService.stopDebugging(csprojPath);
						container.debugTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.runGroup',
				async (item: any) => {
					if (item && item.group) {
						const structure = await container.projectScanner.scanWorkspace(
							vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
						);
						await container.debugService.startGroup(item.group, structure.projects);
						container.debugTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.stopGroup',
				async (item: any) => {
					if (item && item.group) {
						const structure = await container.projectScanner.scanWorkspace(
							vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
						);
						await container.debugService.stopGroup(item.group, structure.projects);
						container.debugTreeProvider.refresh();
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.createGroup',
				async () => {
					const name = await vscode.window.showInputBox({
						prompt: 'Enter Debug Group Name',
						placeHolder: 'Frontend & Backend',
					});
					if (!name) return;

					const structure = await container.projectScanner.scanWorkspace(
						vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
					);
					if (structure.projects.length === 0) {
						vscode.window.showWarningMessage('No projects found to group.');
						return;
					}

					const projectPicks = structure.projects.map((p) => ({
						label: p.name,
						description: vscode.workspace.asRelativePath(p.projectDir),
						project: p,
					}));

					const selected = await vscode.window.showQuickPick(projectPicks, {
						canPickMany: true,
						placeHolder: 'Select projects to include in this debug group',
					});

					if (selected && selected.length > 0) {
						await container.debugConfigService.addGroup({
							name: name,
							projects: selected.map((s) => s.project.name),
						});
						container.debugTreeProvider.refresh();
						vscode.window.showInformationMessage(`Debug group '${name}' created!`);
					}
				}
			),
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.debug.deleteGroup',
				async (item: any) => {
					if (item && item.group) {
						const confirm = await vscode.window.showWarningMessage(
							`Delete debug group '${item.group.name}'?`,
							{ modal: true },
							'Delete'
						);
						if (confirm === 'Delete') {
							await container.debugConfigService.deleteGroup(item.group.name);
							container.debugTreeProvider.refresh();
						}
					}
				}
			),
			vscode.commands.registerCommand('dotnet-project-toolkit.debug.stopAll', async () => {
				await container.debugService.stopAll();
				container.debugTreeProvider.refresh();
			})
		);

		// Register createProfileWithPanel command
		context.subscriptions.push(
			vscode.commands.registerCommand(
				'dotnet-project-toolkit.createProfileWithPanel',
				async (args: any) => {
					if (args && args.projectInfo && args.profileName && args.environment) {
						ProfileInfoPanel.showForCreate(
							context.extensionUri,
							args.projectInfo,
							args.profileName,
							args.environment,
							container.profileService,
							container.passwordStorage,
							container.historyManager,
							container.outputChannel,
							onRefresh
						);
					}
				}
			)
		);

		container.outputChannel.appendLine('[Container] All services initialized');

		return container;
	}
}
