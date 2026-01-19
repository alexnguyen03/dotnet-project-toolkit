import * as vscode from 'vscode';
import * as path from 'path';
import { PublishProfileInfo } from '../models/ProjectModels';
import { IPasswordStorage } from '../strategies/IPasswordStorage';

/**
 * Deployment result
 */
export interface DeploymentResult {
    success: boolean;
    errorMessage?: string;
    output: string;
}

/**
 * Deployment Service Interface
 * Handles actual deployment execution via dotnet publish
 */
export interface IDeploymentService {
    deploy(
        projectPath: string,
        projectName: string,
        profileInfo: PublishProfileInfo,
        onProgress?: (message: string, increment: number) => void
    ): Promise<DeploymentResult>;
}

/**
 * Deployment Service Implementation
 * Executes dotnet publish with MSDeploy parameters
 */
export class DeploymentService implements IDeploymentService {
    constructor(
        private readonly outputChannel: vscode.OutputChannel,
        private readonly passwordStorage: IPasswordStorage
    ) { }

    async deploy(
        projectPath: string,
        projectName: string,
        profileInfo: PublishProfileInfo,
        onProgress?: (message: string, increment: number) => void
    ): Promise<DeploymentResult> {
        try {
            // 1. Get password from storage
            onProgress?.('Retrieving credentials...', 10);
            const password = await this.getPassword(projectName, profileInfo.fileName);
            if (!password) {
                return {
                    success: false,
                    errorMessage: 'Password not found. Please configure credentials first.',
                    output: ''
                };
            }

            // 2. Build dotnet publish command
            onProgress?.('Building project...', 30);
            const command = this.buildPublishCommand(projectPath, profileInfo, password);
            this.log(`Executing: ${command.replace(password, '***')}`);

            // 3. Execute deployment
            onProgress?.('Publishing to IIS...', 60);
            const result = await this.executeCommand(command, path.dirname(projectPath));

            // 4. Check result
            if (result.exitCode === 0) {
                onProgress?.('Deployment complete!', 100);
                return {
                    success: true,
                    output: result.output
                };
            } else {
                return {
                    success: false,
                    errorMessage: this.extractErrorMessage(result.output),
                    output: result.output
                };
            }

        } catch (error: any) {
            this.log(`Deployment error: ${error.message}`);
            return {
                success: false,
                errorMessage: error.message || 'Unknown deployment error',
                output: error.toString()
            };
        }
    }

    /**
     * Get password from storage
     */
    private async getPassword(projectName: string, profileName: string): Promise<string | undefined> {
        const key = this.passwordStorage.generateKey(projectName, profileName);
        return await this.passwordStorage.retrieve(key);
    }

    /**
     * Build dotnet publish command with MSDeploy parameters
     */
    private buildPublishCommand(projectPath: string, profileInfo: PublishProfileInfo, password: string): string {
        const profileName = profileInfo.fileName;
        
        // Use dotnet publish with PublishProfile and Password parameters
        // Note: Do NOT use /p:DeployOnBuild=true as it causes circular dependency
        // dotnet publish with PublishProfile already handles deployment
        const args = [
            'dotnet',
            'publish',
            `"${projectPath}"`,
            `/p:PublishProfile="${profileName}"`,
            `/p:Password="${password}"`,
            '/p:Configuration=Release',
            '/p:AllowUntrustedCertificate=true' // Allow self-signed certificates
        ];

        return args.join(' ');
    }

    /**
     * Execute command and capture output
     */
    private async executeCommand(command: string, cwd: string): Promise<{ exitCode: number; output: string }> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            let output = '';

            const process = exec(command, {
                cwd,
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large outputs
                shell: 'powershell.exe' // Use PowerShell on Windows
            });

            process.stdout?.on('data', (data: Buffer) => {
                const text = data.toString();
                output += text;
                this.outputChannel.append(text);
            });

            process.stderr?.on('data', (data: Buffer) => {
                const text = data.toString();
                output += text;
                this.outputChannel.append(text);
            });

            process.on('close', (code: number) => {
                resolve({
                    exitCode: code || 0,
                    output
                });
            });

            process.on('error', (error: Error) => {
                output += `\nProcess error: ${error.message}`;
                this.outputChannel.appendLine(`Process error: ${error.message}`);
                resolve({
                    exitCode: 1,
                    output
                });
            });
        });
    }

    /**
     * Extract meaningful error message from output
     */
    private extractErrorMessage(output: string): string {
        // Look for common error patterns
        const errorPatterns = [
            /error\s*:\s*(.+)/i,
            /failed\s*:\s*(.+)/i,
            /exception\s*:\s*(.+)/i,
            /Build FAILED/i
        ];

        for (const pattern of errorPatterns) {
            const match = output.match(pattern);
            if (match) {
                return match[1] || match[0];
            }
        }

        // If no specific error found, return last few lines
        const lines = output.split('\n').filter(l => l.trim());
        return lines.slice(-5).join('\n') || 'Deployment failed. Check output for details.';
    }

    private log(message: string): void {
        this.outputChannel.appendLine(`[DeploymentService] ${message}`);
    }
}
