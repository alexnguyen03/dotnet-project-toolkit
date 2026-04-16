import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProfileXmlGenerator } from '../generators/ProfileXmlGenerator';
import { DeployEnvironment } from '../models/ProjectModels';
import { EnvVarPasswordStorage } from '../strategies/EnvVarPasswordStorage';
import { runProcess } from '../utils/ProcessRunner';

function collectTypeScriptFiles(dir: string): string[] {
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTypeScriptFiles(fullPath));
		} else if (entry.isFile() && fullPath.endsWith('.ts')) {
			files.push(fullPath);
		}
	}

	return files;
}

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Contributed commands are registered in source', () => {
		const root = path.resolve(__dirname, '..', '..');
		const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
		const contributedCommands: string[] = (pkg.contributes?.commands || []).map(
			(c: { command: string }) => c.command
		);
		const contributed = new Set<string>(contributedCommands);

		const registered = new Set<string>();
		const sourceFiles = collectTypeScriptFiles(path.join(root, 'src'));

		for (const file of sourceFiles) {
			const content = fs.readFileSync(file, 'utf-8');
			const idRegex = /readonly id\s*=\s*'([^']+)'/g;
			const registerRegex = /registerCommand\(\s*'([^']+)'/g;
			let match: RegExpExecArray | null;

			while ((match = idRegex.exec(content)) !== null) {
				registered.add(match[1]);
			}

			while ((match = registerRegex.exec(content)) !== null) {
				registered.add(match[1]);
			}
		}

		const missing = [...contributed].filter((command) => !registered.has(command));
		assert.deepStrictEqual(missing, []);
	});

	test('ProfileXmlGenerator escapes XML reserved chars', () => {
		const generator = new ProfileXmlGenerator();
		const xml = generator.generate(
			{
				profileName: 'staging',
				environment: DeployEnvironment.Staging,
				publishUrl: 'host&name<unsafe>',
				siteName: 'site"name',
				username: "user'name",
				password: 'secret',
				siteUrl: 'https://example.com?a=1&b=2',
				linkedBranch: 'feature/<branch>',
				logPath: 'D:\\logs\\stdout&next',
			},
			'net8.0'
		);

		assert.ok(xml.includes('host&amp;name&lt;unsafe&gt;'));
		assert.ok(xml.includes('site&quot;name'));
		assert.ok(xml.includes('user&apos;name'));
		assert.ok(xml.includes('https://example.com?a=1&amp;b=2'));
		assert.ok(xml.includes('feature/&lt;branch&gt;'));
	});

	test('ProcessRunner passes literal args without shell expansion', async () => {
		const result = await runProcess(
			'node',
			['-e', 'console.log(process.argv[1])', 'value&with|special;chars'],
			{ timeoutMs: 5000 }
		);

		assert.strictEqual(result.exitCode, 0);
		assert.ok(result.output.includes('value&with|special;chars'));
	});

	test('EnvVarPasswordStorage store is immediately retrievable in current process', async () => {
		const outputChannel = {
			appendLine: (_message: string) => {
				// no-op
			},
		} as unknown as vscode.OutputChannel;

		const storage = new EnvVarPasswordStorage(
			outputChannel,
			async () => ({
				exitCode: 0,
				output: 'OK',
				timedOut: false,
			}),
			() => 'win32'
		);

		const key = 'DEPLOY_PWD_TEST_SESSION';
		const value = 'Pa$$w0rd!';
		const stored = await storage.store(key, value);
		const retrieved = await storage.retrieve(key);

		assert.strictEqual(stored, true);
		assert.strictEqual(retrieved, value);

		delete process.env[key];
	});
});
