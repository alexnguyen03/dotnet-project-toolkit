import * as fs from 'fs';
import { IFileSystemRepository } from './IFileSystemRepository';

/**
 * File System Repository Implementation
 * Concrete implementation using Node.js fs module
 */
export class FileSystemRepository implements IFileSystemRepository {
    exists(path: string): boolean {
        return fs.existsSync(path);
    }

    async readFile(path: string): Promise<string> {
        return await fs.promises.readFile(path, 'utf-8');
    }

    async writeFile(path: string, content: string): Promise<void> {
        await fs.promises.writeFile(path, content, 'utf-8');
    }

    async deleteFile(path: string): Promise<void> {
        await fs.promises.unlink(path);
    }

    async ensureDirectory(path: string): Promise<void> {
        await fs.promises.mkdir(path, { recursive: true });
    }

    readFileSync(path: string): string {
        return fs.readFileSync(path, 'utf-8');
    }

    writeFileSync(path: string, content: string): void {
        fs.writeFileSync(path, content, 'utf-8');
    }

    deleteFileSync(path: string): void {
        fs.unlinkSync(path);
    }
}
