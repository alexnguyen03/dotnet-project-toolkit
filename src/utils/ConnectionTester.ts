import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { PublishProfileInfo } from '../models/ProjectModels';

export class ConnectionTester {
    static async testConnection(profile: PublishProfileInfo, outputChannel?: vscode.OutputChannel): Promise<{ success: boolean; message: string }> {
        const method = profile.publishMethod || 'FileSystem';

        if (method.includes('MSDeploy')) {
            return this.testMSDeployConnection(profile, outputChannel);
        } else if (method.includes('FileSystem')) {
            return this.testFileSystemConnection(profile, outputChannel);
        } else {
            return {
                success: true,
                message: `Unknown publish method '${method}'. Assuming OK.`
            };
        }
    }

    private static async testMSDeployConnection(profile: PublishProfileInfo, outputChannel?: vscode.OutputChannel): Promise<{ success: boolean; message: string }> {
        const urlStr = profile.publishUrl;
        if (!urlStr) {
            return { success: false, message: 'No Publish URL defined in profile.' };
        }

        // Ensure protocol
        let targetUrl = urlStr;
        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://${targetUrl}`;
        }

        outputChannel?.appendLine(`[TestConnection] Connecting to: ${targetUrl}`);

        return new Promise((resolve) => {
            try {
                const url = new URL(targetUrl);
                const requestLib = url.protocol === 'https:' ? https : http;

                const req = requestLib.request(targetUrl, {
                    method: 'HEAD',
                    rejectUnauthorized: false, // Self-signed certs are common for WebDeploy
                    timeout: 10000 // 10s timeout
                }, (res) => {
                    outputChannel?.appendLine(`[TestConnection] Status Code: ${res.statusCode}`);

                    // 401 Unauthorized is actually GOOD here - it means the server is reachable and asking for auth
                    // 200 OK is also good (rare for msdeploy.axd without auth)
                    if (res.statusCode && (res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 403)) {
                        resolve({
                            success: true,
                            message: `Successfully connected to ${url.host} (Status: ${res.statusCode})`
                        });
                    } else {
                        resolve({
                            success: false,
                            message: `Server returned status code: ${res.statusCode}`
                        });
                    }
                });

                req.on('error', (err) => {
                    outputChannel?.appendLine(`[TestConnection] Request error: ${err.message}`);
                    resolve({
                        success: false,
                        message: `Could not connect to ${url.host}: ${err.message}`
                    });
                });

                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        success: false,
                        message: `Connection timed out to ${url.host}`
                    });
                });

                req.end();
            } catch (err: any) {
                resolve({ success: false, message: `Invalid URL: ${err.message}` });
            }
        });
    }

    private static async testFileSystemConnection(profile: PublishProfileInfo, outputChannel?: vscode.OutputChannel): Promise<{ success: boolean; message: string }> {
        const targetPath = profile.publishUrl; // properties/PublishProfiles usually map publishUrl to target path for FileSystem

        if (!targetPath) {
            return { success: false, message: 'No target path defined (publishUrl).' };
        }

        outputChannel?.appendLine(`[TestConnection] Checking path: ${targetPath}`);

        if (fs.existsSync(targetPath)) {
            try {
                // Try to write a temp file to test permissions
                const testFile = path.join(targetPath, '.dotnet-toolkit-test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                return { success: true, message: `Directory exists and is writable: ${targetPath}` };
            } catch (err: any) {
                return { success: false, message: `Directory exists but not writable: ${err.message}` };
            }
        } else {
            // Check if parent exists
            try {
                const parent = path.dirname(targetPath);
                if (fs.existsSync(parent)) {
                    return { success: true, message: `Target directory does not exist but parent is reachable. It will be created on deploy.` };
                }
            } catch (e) { /* ignore */ }

            return { success: false, message: `Target path does not exist: ${targetPath}` };
        }
    }
}
