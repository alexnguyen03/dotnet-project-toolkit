import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ICommand } from './ICommand';
import { ProjectInfo } from '../models/ProjectModels';

export class ProfileImportCommand implements ICommand {
	readonly id = 'dotnet-project-toolkit.importPublishProfile';

	constructor(
		private readonly outputChannel: vscode.OutputChannel,
		private readonly onRefresh: () => void
	) {}

	async execute(item?: unknown): Promise<void> {
		const treeItem = item as { projectInfo?: ProjectInfo };

		try {
			const uri = await vscode.window.showOpenDialog({
				title: 'Import Publish Profile',
				openLabel: 'Import',
				filters: {
					'Publish Profile': ['pubxml'],
					'All Files': ['*'],
				},
			});

			if (!uri || uri.length === 0) {
				return;
			}

			const sourcePath = uri[0].fsPath;
			const sourceContent = fs.readFileSync(sourcePath, 'utf-8');

			const sourceFileName = path.basename(sourcePath);
			this.outputChannel.appendLine(`[Import] Selected: ${sourceFileName}`);

			const targetFolder = await this.selectTargetFolder(treeItem?.projectInfo);

			if (!targetFolder) {
				this.outputChannel.appendLine('[Import] Cancelled - no folder selected');
				return;
			}

			const publishProfilesDir = path.join(targetFolder, 'Properties', 'PublishProfiles');

			if (!fs.existsSync(publishProfilesDir)) {
				fs.mkdirSync(publishProfilesDir, { recursive: true });
			}

			const profileName = await vscode.window.showInputBox({
				prompt: 'Enter profile name',
				value: sourceFileName.replace('.pubxml', ''),
				validateInput: (v: string) => {
					if (!v?.trim()) return 'Profile name is required';
					if (!/^[a-zA-Z0-9-_]+$/.test(v))
						return 'Only letters, numbers, hyphens, underscores';
					return null;
				},
			});

			if (!profileName) {
				this.outputChannel.appendLine('[Import] Cancelled - no profile name');
				return;
			}

			const targetPath = path.join(publishProfilesDir, `${profileName}.pubxml`);

			if (fs.existsSync(targetPath)) {
				const overwrite = await vscode.window.showWarningMessage(
					`Profile "${profileName}" already exists. Overwrite?`,
					{ modal: true },
					'Overwrite',
					'Cancel'
				);

				if (overwrite !== 'Overwrite') {
					this.outputChannel.appendLine('[Import] Cancelled - profile exists');
					return;
				}
			}

			fs.writeFileSync(targetPath, sourceContent, 'utf-8');

			const projectName = path.basename(targetFolder);
			vscode.window.showInformationMessage(
				`✅ Profile imported: ${profileName} -> ${projectName}`
			);
			this.outputChannel.appendLine(`[Import] Success: ${profileName} -> ${projectName}`);

			this.onRefresh();
		} catch (error: any) {
			vscode.window.showErrorMessage(`Failed to import profile: ${error.message}`);
			this.outputChannel.appendLine(`[Import] Error: ${error.message}`);
		}
	}

	private async selectTargetFolder(currentProject?: ProjectInfo): Promise<string | undefined> {
		const workspaceFolders = vscode.workspace.workspaceFolders;

		if (!workspaceFolders || workspaceFolders.length === 0) {
			vscode.window.showErrorMessage('No workspace folder found');
			return undefined;
		}

		const folders = workspaceFolders.map((f) => f.uri.fsPath);

		if (folders.length === 1) {
			const hasCsproj = fs
				.readdirSync(folders[0])
				.some((file: string) => file.endsWith('.csproj'));
			if (hasCsproj) {
				return folders[0];
			}
		}

		const items: vscode.QuickPickItem[] = folders.map((folder) => {
			const name = path.basename(folder);
			const hasCsproj = fs
				.readdirSync(folder)
				.some((file: string) => file.endsWith('.csproj'));
			return {
				label: name,
				description: folder,
				detail: hasCsproj ? '.NET Project' : 'Folder',
			};
		});

		const selected = await vscode.window.showQuickPick(items, {
			placeHolder: 'Select target project folder',
		});

		return selected?.description;
	}
}
