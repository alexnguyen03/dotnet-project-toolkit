import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Manages OS environment variables for storing deployment passwords
 */
export class EnvironmentManager {
    /**
     * Generate standardized environment variable name for a profile
     * Example: ("BudgetControl.Server.Api", "uat-api") -> "DEPLOY_PWD_BUDGETCONTROL_SERVER_API_UAT_API"
     */
    generatePasswordVarName(projectName: string, profileName: string): string {
        const sanitizedProject = projectName
            .replace(/\./g, '_')  // Replace dots with underscores
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, '_')
            .replace(/_+/g, '_');
        const sanitizedProfile = profileName
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '_')
            .replace(/_+/g, '_');
        return `DEPLOY_PWD_${sanitizedProject}_${sanitizedProfile}`;
    }

    /**
     * Set environment variable for deployment password
     * Windows: Uses setx command (User scope)
     * Linux/Mac: Appends to shell profile
     */
    async setEnvironmentVariable(varName: string, value: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
        try {
            if (os.platform() === 'win32') {
                return await this.setWindowsEnvVar(varName, value, outputChannel);
            } else {
                return await this.setUnixEnvVar(varName, value, outputChannel);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to set environment variable: ${error}`);
            return false;
        }
    }

    /**
     * Set Windows environment variable using setx
     */
    private async setWindowsEnvVar(varName: string, value: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
        return new Promise((resolve) => {
            // Escape special characters in PowerShell
            const escapedValue = value.replace(/"/g, '`"');
            const command = `setx ${varName} "${escapedValue}"`;
            
            outputChannel.appendLine(`[EnvVar] Setting Windows environment variable: ${varName}`);
            
            child_process.exec(command, (error, stdout, stderr) => {
                if (error) {
                    outputChannel.appendLine(`[EnvVar] Error: ${error.message}`);
                    outputChannel.appendLine(`[EnvVar] stderr: ${stderr}`);
                    vscode.window.showErrorMessage(`Failed to set environment variable: ${error.message}`);
                    resolve(false);
                } else {
                    outputChannel.appendLine(`[EnvVar] ${stdout}`);
                    outputChannel.appendLine(`[EnvVar] ✓ Environment variable set successfully`);
                    outputChannel.appendLine(`[EnvVar] NOTE: You may need to restart your terminal for changes to take effect`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Set Unix/Linux/Mac environment variable by appending to shell profile
     */
    private async setUnixEnvVar(varName: string, value: string, outputChannel: vscode.OutputChannel): Promise<boolean> {
        const homeDir = os.homedir();
        const shellProfilePaths = [
            path.join(homeDir, '.bashrc'),
            path.join(homeDir, '.zshrc'),
            path.join(homeDir, '.profile'),
        ];

        // Find which shell profile exists
        const existingProfile = shellProfilePaths.find(p => fs.existsSync(p));
        
        if (!existingProfile) {
            vscode.window.showWarningMessage('No shell profile found. Please set the environment variable manually.');
            outputChannel.appendLine(`[EnvVar] No shell profile found. Manual setup required.`);
            outputChannel.appendLine(`[EnvVar] Add this line to your shell profile: export ${varName}="${value}"`);
            return false;
        }

        const exportLine = `\nexport ${varName}="${value}"\n`;
        
        try {
            fs.appendFileSync(existingProfile, exportLine);
            outputChannel.appendLine(`[EnvVar] ✓ Added to ${existingProfile}`);
            outputChannel.appendLine(`[EnvVar] Run: source ${existingProfile} or restart terminal`);
            vscode.window.showInformationMessage(`Environment variable added to ${path.basename(existingProfile)}`);
            return true;
        } catch (error) {
            outputChannel.appendLine(`[EnvVar] Error writing to ${existingProfile}: ${error}`);
            return false;
        }
    }

    /**
     * Get environment variable value
     */
    getEnvironmentVariable(varName: string): string | undefined {
        return process.env[varName];
    }

    /**
     * Show info message about how to use the password variable
     */
    showPasswordVarInfo(varName: string): void {
        const platform = os.platform();
        const usageExample = platform === 'win32'
            ? `/p:Password=$env:${varName}`
            : `/p:Password=$${varName}`;

        vscode.window.showInformationMessage(
            `Password saved to ${varName}. Use in deploy: ${usageExample}`,
            'OK'
        );
    }
}
