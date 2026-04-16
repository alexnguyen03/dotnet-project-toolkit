import { spawn, SpawnOptions } from 'child_process';

export interface ProcessRunResult {
	exitCode: number;
	output: string;
	timedOut: boolean;
	error?: string;
}

export interface ProcessRunOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	timeoutMs?: number;
	maxOutputBytes?: number;
	onStdout?: (text: string) => void;
	onStderr?: (text: string) => void;
}

/**
 * Run a process safely without invoking a shell.
 */
export function runProcess(
	command: string,
	args: string[],
	options: ProcessRunOptions = {}
): Promise<ProcessRunResult> {
	return new Promise((resolve) => {
		const spawnOptions: SpawnOptions = {
			cwd: options.cwd,
			env: options.env || process.env,
			shell: false,
			windowsHide: true,
		};

		const child = spawn(command, args, spawnOptions);
		let output = '';
		let timedOut = false;
		let finished = false;
		const maxOutputBytes = options.maxOutputBytes ?? 10 * 1024 * 1024;
		let outputBytes = 0;

		const appendOutput = (text: string) => {
			const bytes = Buffer.byteLength(text);
			outputBytes += bytes;

			if (outputBytes <= maxOutputBytes) {
				output += text;
				return;
			}

			if (outputBytes - bytes < maxOutputBytes) {
				output += '\n[ProcessRunner] Output truncated: max buffer exceeded.';
			}
		};

		const finish = (result: ProcessRunResult) => {
			if (finished) {
				return;
			}
			finished = true;
			resolve(result);
		};

		let timeoutId: NodeJS.Timeout | undefined;
		const timeoutMs = options.timeoutMs ?? 300000;
		if (timeoutMs > 0) {
			timeoutId = setTimeout(() => {
				timedOut = true;
				child.kill();
				appendOutput(`\n[ProcessRunner] Timed out after ${timeoutMs / 1000}s`);
			}, timeoutMs);
		}

		child.stdout?.on('data', (data: Buffer) => {
			const text = data.toString();
			appendOutput(text);
			options.onStdout?.(text);
		});

		child.stderr?.on('data', (data: Buffer) => {
			const text = data.toString();
			appendOutput(text);
			options.onStderr?.(text);
		});

		child.on('error', (error: Error) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			appendOutput(`\n[ProcessRunner] Error: ${error.message}`);
			finish({
				exitCode: 1,
				output,
				timedOut,
				error: error.message,
			});
		});

		child.on('close', (code: number | null) => {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
			finish({
				exitCode: timedOut ? 124 : (code ?? 0),
				output,
				timedOut,
			});
		});
	});
}
