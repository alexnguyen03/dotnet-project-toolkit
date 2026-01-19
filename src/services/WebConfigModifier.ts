import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Web.config Modifier Service
 * Modifies web.config on remote IIS server after deployment
 */
export interface IWebConfigModifier {
  /**
   * Enable or disable stdout logging in web.config
   * @param publishUrl The IIS server URL (e.g., "server.com:8172")
   * @param siteName The IIS site name/path
   * @param userName Deployment username
   * @param password Deployment password
   * @param enable Whether to enable or disable stdout logging
   */
  modifyStdoutLogging(
    publishUrl: string,
    siteName: string,
    userName: string,
    password: string,
    enable: boolean,
  ): Promise<void>;
}

/**
 * Web.config Modifier Implementation
 * Uses MSDeploy to modify web.config on remote server
 */
export class WebConfigModifier implements IWebConfigModifier {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async modifyStdoutLogging(
    publishUrl: string,
    siteName: string,
    userName: string,
    password: string,
    enable: boolean,
  ): Promise<void> {
    try {
      this.log(
        `Modifying web.config stdout logging: ${enable ? "ENABLE" : "DISABLE"}`,
      );

      // Build PowerShell script to modify web.config via MSDeploy
      // We'll use setParameter to modify the aspNetCore element
      const script = this.buildModificationScript(
        publishUrl,
        siteName,
        userName,
        password,
        enable,
      );

      this.log("Executing web.config modification...");
      const { stdout, stderr } = await execAsync(script, {
        shell: "powershell.exe",
        maxBuffer: 10 * 1024 * 1024,
      });

      if (stdout) {
        this.log(`Output: ${stdout}`);
      }
      if (stderr) {
        this.log(`Stderr: ${stderr}`);
      }

      this.log("✓ Web.config modified successfully");
    } catch (error: any) {
      this.log(`Error modifying web.config: ${error.message}`);
      // Don't throw - this is a non-critical post-deployment step
      vscode.window.showWarningMessage(
        `Deployment succeeded, but failed to modify web.config stdout logging: ${error.message}`,
      );
    }
  }

  private buildModificationScript(
    publishUrl: string,
    siteName: string,
    userName: string,
    password: string,
    enable: boolean,
  ): string {
    // Use MSDeploy runCommand to modify web.config
    // This approach uses PowerShell to edit the XML file remotely
    const stdoutEnabled = enable ? "true" : "false";
    const stdoutLogFile = ".\\logs\\stdout";

    // PowerShell script to modify web.config
    const psScript = `
            $webConfigPath = "$env:SystemDrive\\inetpub\\wwwroot\\${siteName}\\web.config"
            if (Test-Path $webConfigPath) {
                [xml]$xml = Get-Content $webConfigPath
                $aspNetCore = $xml.configuration.'system.webServer'.aspNetCore
                if ($aspNetCore) {
                    $aspNetCore.SetAttribute('stdoutLogEnabled', '${stdoutEnabled}')
                    $aspNetCore.SetAttribute('stdoutLogFile', '${stdoutLogFile}')
                    $xml.Save($webConfigPath)
                    Write-Host "Updated web.config: stdoutLogEnabled=${stdoutEnabled}"
                } else {
                    Write-Host "aspNetCore element not found in web.config"
                }
            } else {
                Write-Host "web.config not found at $webConfigPath"
            }
            `.replace(/\n/g, "; ");

    // Build msdeploy command to run PowerShell script remotely
    const command =
      `msdeploy.exe -verb:sync ` +
      `-source:runCommand="${psScript}",waitInterval=5000 ` +
      `-dest:auto,computerName="https://${publishUrl}/msdeploy.axd?site=${siteName}",` +
      `userName="${userName}",password="${password}",authType="Basic" ` +
      `-allowUntrusted`;

    return command;
  }

  private log(message: string): void {
    this.outputChannel.appendLine(`[WebConfigModifier] ${message}`);
  }
}
