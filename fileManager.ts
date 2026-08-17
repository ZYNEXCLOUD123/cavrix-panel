import fs from 'fs-extra';
import path from 'path';
import { sanitizePath, formatBytes } from '../utils/sanitize.js';
import { NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
}

export class FileManager {
  private serverPath: string;

  constructor(serverId: string, serverPath?: string) {
    this.serverPath = serverPath || path.join(process.cwd(), '.data', 'servers', serverId);
  }

  private resolveAndValidate(userPath: string): string {
    const safePath = sanitizePath(userPath, this.serverPath);
    if (!safePath) {
      throw new ForbiddenError('Path access denied.');
    }
    return safePath;
  }

  async listDirectory(dirPath: string = '.'): Promise<FileEntry[]> {
    const resolved = this.resolveAndValidate(dirPath);

    try {
      const exists = await fs.pathExists(resolved);
      if (!exists) throw new NotFoundError('Directory');

      const entries = await fs.readdir(resolved, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue; // Skip hidden files

        const entryPath = path.join(resolved, entry.name);
        const relativePath = path.relative(this.serverPath, entryPath).replace(/\\/g, '/');

        try {
          const stat = await fs.stat(entryPath);
          result.push({
            name: entry.name,
            path: relativePath,
            type: entry.isDirectory() ? 'directory' : 'file',
            size: stat.size,
            modified: stat.mtime.toISOString(),
            permissions: (stat.mode & 0o777).toString(8),
          });
        } catch {
          // Skip files we can't stat
        }
      }

      return result.sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'directory' ? -1 : 1;
      });
    } catch (error: any) {
      if (error instanceof NotFoundError || error instanceof ForbiddenError) throw error;
      throw new AppError(500, 'FILE_ERROR', `Failed to list directory: ${error.message}`);
    }
  }

  async readFile(filePath: string): Promise<string> {
    const resolved = this.resolveAndValidate(filePath);
    const stat = await fs.stat(resolved);

    if (stat.size > 50 * 1024 * 1024) {
      throw new AppError(413, 'FILE_TOO_LARGE', 'File too large to read (max 50MB).');
    }

    return fs.readFile(resolved, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolved = this.resolveAndValidate(filePath);
    const dir = path.dirname(resolved);
    await fs.ensureDir(dir);
    await fs.writeFile(resolved, content, 'utf-8');
    logger.debug(`[FILE] Written: ${filePath}`);
  }

  async createFile(filePath: string): Promise<void> {
    const resolved = this.resolveAndValidate(filePath);
    const exists = await fs.pathExists(resolved);
    if (exists) throw new AppError(409, 'CONFLICT', 'File already exists.');

    await fs.ensureDir(path.dirname(resolved));
    await fs.writeFile(resolved, '', 'utf-8');
  }

  async createDirectory(dirPath: string): Promise<void> {
    const resolved = this.resolveAndValidate(dirPath);
    const exists = await fs.pathExists(resolved);
    if (exists) throw new AppError(409, 'CONFLICT', 'Directory already exists.');

    await fs.ensureDir(resolved);
  }

  async delete(targetPath: string): Promise<void> {
    const resolved = this.resolveAndValidate(targetPath);
    const exists = await fs.pathExists(resolved);
    if (!exists) throw new NotFoundError('File/Directory');

    await fs.remove(resolved);
    logger.debug(`[FILE] Deleted: ${targetPath}`);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    const resolvedOld = this.resolveAndValidate(oldPath);
    const resolvedNew = this.resolveAndValidate(newPath);

    const exists = await fs.pathExists(resolvedOld);
    if (!exists) throw new NotFoundError('File/Directory');

    const newExists = await fs.pathExists(resolvedNew);
    if (newExists) throw new AppError(409, 'CONFLICT', 'Destination already exists.');

    await fs.rename(resolvedOld, resolvedNew);
  }

  async copy(sourcePath: string, destPath: string): Promise<void> {
    const resolvedSource = this.resolveAndValidate(sourcePath);
    const resolvedDest = this.resolveAndValidate(destPath);

    const exists = await fs.pathExists(resolvedSource);
    if (!exists) throw new NotFoundError('Source');

    await fs.copy(resolvedSource, resolvedDest);
  }

  async move(sourcePath: string, destPath: string): Promise<void> {
    await this.copy(sourcePath, destPath);
    await this.delete(sourcePath);
  }

  async getFileInfo(filePath: string): Promise<FileEntry> {
    const resolved = this.resolveAndValidate(filePath);
    const exists = await fs.pathExists(resolved);
    if (!exists) throw new NotFoundError('File/Directory');

    const stat = await fs.stat(resolved);
    const name = path.basename(resolved);
    const relativePath = path.relative(this.serverPath, resolved).replace(/\\/g, '/');

    return {
      name,
      path: relativePath,
      type: stat.isDirectory() ? 'directory' : 'file',
      size: stat.size,
      modified: stat.mtime.toISOString(),
      permissions: (stat.mode & 0o777).toString(8),
    };
  }

  async diskUsage(dirPath: string = '.'): Promise<number> {
    const resolved = this.resolveAndValidate(dirPath);
    const { execSync } = await import('child_process');
    try {
      const output = execSync(`du -sb "${resolved}" 2>/dev/null || echo 0`, { encoding: 'utf-8' });
      return parseInt(output.split('\t')[0]) || 0;
    } catch {
      return 0;
    }
  }
}
