import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { BasePasswordStorage } from './IPasswordStorage';
import { ProcessRunResult, runProcess } from '../utils/ProcessRunner';

/**
 * Environment Variable Password Storage Strategy
 * Stores passwords in OS environment variables
 * - Windows: Uses setx command
 * - Unix/Mac: Appends to shell profile
 */
export class EnvVarPasswordStorage extends BasePasswordStorage {
	readonly type = 'envvar' as const;
	private readonly processRunner: (
		command: string,
		args: string[]
	) => Promise<ProcessRunResult>;
	private readonly platformResolver: () => NodeJS.Platform;

	constructor(
		outputChannel: vscode.OutputChannel,
		processRunner: (command: string, args: string[]) => Promise<ProcessRunResult> = (
			command,
			args
		) =>
			runProcess(command, args, {
				timeoutMs: 30000,
				maxOutputBytes: 1024 * 1024,
			}),
		platformResolver: () => NodeJS.Platform = os.platform
	) {
		super(outputChannel);
		this.processRunner = processRunner;
		this.platformResolver = platformResolver;
	}

	async store(key: string, value: string): Promise<boolean> {
		if (!key || !value) {
			this.log('Error: Key and value are required');
			return false;
		}
		this.log('WARNING: EnvVar storage is less secure. Passwords are visible to local processes.');
		try {
			const stored = this.platformResolver() === 'win32'
				? await this.storeWindows(key, value)
				: await this.storeUnix(key, value);

			if (stored) {
				// Keep current extension process in sync immediately.
				process.env[key] = value;
			}

			return stored;
		} catch (error) {
			this.log(`Error storing: ${error}`);
			return false;
		}
	}

	async retrieve(key: string): Promise<string | undefined> {
		if (!key) {
			this.log('Warning: Empty key provided to retrieve');
			return undefined;
		}
		return process.env[key];
	}

	async delete(key: string): Promise<boolean> {
		if (!key) {
			this.log('Warning: Empty key provided to delete');
			return false;
		}
		delete process.env[key];
		this.log(`Cannot programmatically delete persisted environment variable ${key}`);
		this.log('To delete manually:');
		if (this.platformResolver() === 'win32') {
			this.log(`  Run: reg delete "HKCU\\Environment" /v ${key} /f`);
		} else {
			this.log('  Remove the export line from your shell profile (.bashrc, .zshrc, etc.)');
		}
		return true;
	}

	private async storeWindows(key: string, value: string): Promise<boolean> {
		this.log(`Setting Windows env var: ${key}`);
		const result = await this.processRunner('setx', [key, value]);

		if (result.exitCode !== 0) {
			this.log(`Error: ${result.output || result.error || 'setx failed'}`);
			return false;
		}

		this.log('Set successfully');
		this.log('NOTE: Restart terminal to apply in new shells');
		return true;
	}

	private async storeUnix(key: string, value: string): Promise<boolean> {
		const homeDir = os.homedir();
		const profiles = ['.bashrc', '.zshrc', '.profile'].map((p) => path.join(homeDir, p));
		const existingProfile = profiles.find((p) => fs.existsSync(p));

		if (!existingProfile) {
			this.log(`No shell profile found. Add manually: export ${key}="${value}"`);
			return false;
		}

		try {
			const content = fs.readFileSync(existingProfile, 'utf-8');
			const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const linePattern = new RegExp(`^\\s*export\\s+${escapedKey}=.*$`, 'm');
			const newLine = `export ${key}="${value}"`;

			if (linePattern.test(content)) {
				const updatedContent = content.replace(linePattern, newLine);
				fs.writeFileSync(existingProfile, updatedContent);
				this.log(`Updated existing entry in ${path.basename(existingProfile)}`);
			} else {
				fs.appendFileSync(existingProfile, `\n${newLine}\n`);
				this.log(`Added to ${path.basename(existingProfile)}`);
			}
			return true;
		} catch (error) {
			this.log(`Error writing: ${error}`);
			return false;
		}
	}
}
