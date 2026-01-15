import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import { BasePasswordStorage } from './IPasswordStorage';

/**
 * Environment Variable Password Storage Strategy
 * Stores passwords in OS environment variables
 * - Windows: Uses setx command
 * - Unix/Mac: Appends to shell profile
 */
export class EnvVarPasswordStorage extends BasePasswordStorage {
    readonly type = 'envvar' as const;

    async store(key: string, value: string): Promise<boolean> {
        try {
            if (os.platform() === 'win32') {
                return await this.storeWindows(key, value);
            } else {
                return await this.storeUnix(key, value);
            }
        } catch (error) {
            this.log(`Error storing: ${error}`);
            return false;
        }
    }

    async retrieve(key: string): Promise<string | undefined> {
        return process.env[key];
    }

    async delete(key: string): Promise<boolean> {
        // OS env vars can't be easily deleted, just log the key
        this.log(`To delete ${key}, manually remove from environment`);
        return true;
    }

    private async storeWindows(key: string, value: string): Promise<boolean> {
        return new Promise((resolve) => {
            const escapedValue = value.replace(/"/g, '`"');
            const command = `setx ${key} "${escapedValue}"`;
            
            this.log(`Setting Windows env var: ${key}`);
            
            child_process.exec(command, (error, stdout) => {
                if (error) {
                    this.log(`Error: ${error.message}`);
                    resolve(false);
                } else {
                    this.log(`✓ Set successfully`);
                    this.log(`NOTE: Restart terminal to apply`);
                    resolve(true);
                }
            });
        });
    }

    private async storeUnix(key: string, value: string): Promise<boolean> {
        const homeDir = os.homedir();
        const profiles = ['.bashrc', '.zshrc', '.profile'].map(p => path.join(homeDir, p));
        const existingProfile = profiles.find(p => fs.existsSync(p));

        if (!existingProfile) {
            this.log(`No shell profile found. Add manually: export ${key}="${value}"`);
            return false;
        }

        try {
            fs.appendFileSync(existingProfile, `\nexport ${key}="${value}"\n`);
            this.log(`✓ Added to ${path.basename(existingProfile)}`);
            return true;
        } catch (error) {
            this.log(`Error writing: ${error}`);
            return false;
        }
    }
}
