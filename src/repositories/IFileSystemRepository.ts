/**
 * File System Repository Interface
 * Abstracts file system operations following Repository Pattern
 * Allows for easier testing and potential alternative implementations
 */
export interface IFileSystemRepository {
    /**
     * Check if a file or directory exists
     */
    exists(path: string): boolean;

    /**
     * Read file content as string
     */
    readFile(path: string): Promise<string>;

    /**
     * Write content to file
     */
    writeFile(path: string, content: string): Promise<void>;

    /**
     * Delete a file
     */
    deleteFile(path: string): Promise<void>;

    /**
     * Ensure directory exists (create if needed)
     */
    ensureDirectory(path: string): Promise<void>;

    /**
     * Read file synchronously
     */
    readFileSync(path: string): string;

    /**
     * Write file synchronously
     */
    writeFileSync(path: string, content: string): void;

    /**
     * Delete file synchronously
     */
    deleteFileSync(path: string): void;
}
