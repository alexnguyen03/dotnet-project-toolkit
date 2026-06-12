import * as cp from 'child_process';
import * as util from 'util';
import * as os from 'os';

const exec = util.promisify(cp.exec);

export interface ActivePort {
	port: number;
	pid: number;
	processName: string;
	protocol: string;
	address: string;
}

export class PortService {
	public async getActivePorts(workspaceProjectNames?: string[]): Promise<ActivePort[]> {
		const projectSet = new Set((workspaceProjectNames || []).map((name) => name.toLowerCase()));
		const platform = os.platform();
		if (platform === 'win32') {
			return this.getWindowsPorts(projectSet);
		} else {
			return this.getUnixPorts(projectSet);
		}
	}

	private isNetOrProjectProcess(processName: string, projectSet: Set<string>): boolean {
		const cleanName = processName.replace(/\.exe$/i, '').toLowerCase();
		return (
			cleanName === 'dotnet' ||
			cleanName === 'iisexpress' ||
			cleanName === 'w3wp' ||
			projectSet.has(cleanName)
		);
	}

	private async getWindowsPorts(projectSet: Set<string>): Promise<ActivePort[]> {
		const pidMap = new Map<number, string>();
		try {
			const { stdout: tasklistOut } = await exec('tasklist /nh /fo csv');
			const lines = tasklistOut.split('\n');
			for (const line of lines) {
				const parts = line.trim().split('","');
				if (parts.length >= 2) {
					const name = parts[0].replace(/^"/, '');
					const pid = parseInt(parts[1], 10);
					if (!isNaN(pid)) {
						pidMap.set(pid, name);
					}
				}
			}
		} catch (err) {
			console.error('Failed to run tasklist', err);
		}

		const activePorts: ActivePort[] = [];
		try {
			const { stdout: netstatOut } = await exec('netstat -ano -p tcp');
			const lines = netstatOut.split('\n');
			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith('TCP')) {
					continue;
				}
				const parts = trimmed.split(/\s+/);
				if (parts.length >= 5 && parts[3] === 'LISTENING') {
					const localAddress = parts[1];
					const pid = parseInt(parts[4], 10);
					if (isNaN(pid)) {
						continue;
					}

					const lastColon = localAddress.lastIndexOf(':');
					if (lastColon === -1) {
						continue;
					}
					const portStr = localAddress.substring(lastColon + 1);
					const port = parseInt(portStr, 10);
					if (isNaN(port)) {
						continue;
					}

					const processName = pidMap.get(pid) || 'Unknown';

					if (this.isNetOrProjectProcess(processName, projectSet)) {
						if (!activePorts.some((ap) => ap.port === port && ap.pid === pid)) {
							activePorts.push({
								port,
								pid,
								processName,
								protocol: 'TCP',
								address: localAddress,
							});
						}
					}
				}
			}
		} catch (err) {
			console.error('Failed to run netstat', err);
		}

		return activePorts.sort((a, b) => a.port - b.port);
	}

	private async getUnixPorts(projectSet: Set<string>): Promise<ActivePort[]> {
		const activePorts: ActivePort[] = [];
		try {
			const { stdout } = await exec('lsof -iTCP -sTCP:LISTEN -P -n');
			const lines = stdout.split('\n');
			for (let i = 1; i < lines.length; i++) {
				const trimmed = lines[i].trim();
				if (!trimmed) {
					continue;
				}
				const parts = trimmed.split(/\s+/);
				if (parts.length >= 9) {
					const processName = parts[0];
					const pid = parseInt(parts[1], 10);
					const localAddress = parts[8];

					const lastColon = localAddress.lastIndexOf(':');
					if (lastColon === -1) {
						continue;
					}
					const portStr = localAddress.substring(lastColon + 1);
					const port = parseInt(portStr, 10);
					if (isNaN(pid) || isNaN(port)) {
						continue;
					}

					if (this.isNetOrProjectProcess(processName, projectSet)) {
						if (!activePorts.some((ap) => ap.port === port && ap.pid === pid)) {
							activePorts.push({
								port,
								pid,
								processName,
								protocol: 'TCP',
								address: localAddress,
							});
						}
					}
				}
			}
		} catch (err) {
			console.error('Failed to run lsof', err);
		}
		return activePorts.sort((a, b) => a.port - b.port);
	}

	public async killPort(pid: number): Promise<void> {
		const platform = os.platform();
		if (platform === 'win32') {
			await exec(`taskkill /F /PID ${pid}`);
		} else {
			await exec(`kill -9 ${pid}`);
		}
	}
}
