import * as vscode from 'vscode';

type TimestampedOutputChannel = vscode.OutputChannel & {
	__timestampWrapped?: boolean;
};

export function withTimestampedAppendLine(
	outputChannel: vscode.OutputChannel
): vscode.OutputChannel {
	const channel = outputChannel as TimestampedOutputChannel;
	if (channel.__timestampWrapped) {
		return channel;
	}

	const originalAppendLine = channel.appendLine.bind(channel);
	channel.appendLine = (value: string): void => {
		const timestamp = new Date().toISOString();
		originalAppendLine(`[${timestamp}] ${value}`);
	};
	channel.__timestampWrapped = true;

	return channel;
}
