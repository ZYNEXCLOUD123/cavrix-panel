import fs from 'fs-extra';
import path from 'path';
import { query } from '../database/pool.js';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const BACKUPS_DIR = path.join(process.cwd(), 'backups');

export class BackupService {
  static async createBackup(serverId: string): Promise<any> {
    const { rows: servers } = await query(`SELECT * FROM servers WHERE id = $1`, [serverId]);
    if (servers.length === 0) throw new NotFoundError('Server');

    const server = servers[0];
    const backupId = uuidv4();
    const backupName = `backup-${Date.now()}`;
    const backupDir = path.join(BACKUPS_DIR, serverId);
    const backupFile = path.join(backupDir, `${backupId}.zip`);

    await fs.ensureDir(backupDir);

    await query(
      `INSERT INTO backups (id, server_id, name, status, file_path) VALUES ($1, $2, $3, 'building', $4)`,
      [backupId, serverId, backupName, backupFile]
    );

    try {
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();

      const serverPath = server.path || path.join(process.cwd(), '.data', 'servers', serverId);

      if (await fs.pathExists(serverPath)) {
        const addDirToZip = async (dirPath: string, zipPath: string) => {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const entryZipPath = path.join(zipPath, entry.name);

            if (entry.isDirectory()) {
              await addDirToZip(fullPath, entryZipPath);
            } else {
              zip.addLocalFile(fullPath, path.dirname(entryZipPath));
            }
          }
        };

        await addDirToZip(serverPath, '');
      }

      zip.writeZip(backupFile);

      const stat = await fs.stat(backupFile);

      await query(
        `UPDATE backups SET status = 'completed', size = $1, is_successful = true, completed_at = NOW() WHERE id = $2`,
        [stat.size, backupId]
      );

      const backup = {
        id: backupId,
        server_id: serverId,
        name: backupName,
        size: stat.size,
        status: 'completed',
        created_at: new Date(),
      };

      logger.info(`[BACKUP] Created backup ${backupId} for server ${serverId} (${stat.size} bytes)`);
      return backup;
    } catch (error: any) {
      await query(`UPDATE backups SET status = 'failed' WHERE id = $1`, [backupId]);
      logger.error(`[BACKUP] Failed: ${error.message}`);
      throw new AppError(500, 'BACKUP_FAILED', `Backup creation failed: ${error.message}`);
    }
  }

  static async listBackups(serverId: string): Promise<any[]> {
    const { rows } = await query(
      `SELECT * FROM backups WHERE server_id = $1 ORDER BY created_at DESC`,
      [serverId]
    );
    return rows;
  }

  static async deleteBackup(backupId: string): Promise<void> {
    const { rows } = await query(`SELECT * FROM backups WHERE id = $1`, [backupId]);
    if (rows.length === 0) throw new NotFoundError('Backup');

    const backup = rows[0];

    if (backup.file_path && (await fs.pathExists(backup.file_path))) {
      await fs.remove(backup.file_path);
    }

    await query(`DELETE FROM backups WHERE id = $1`, [backupId]);
    logger.info(`[BACKUP] Deleted backup ${backupId}`);
  }

  static async getBackup(backupId: string): Promise<any> {
    const { rows } = await query(`SELECT * FROM backups WHERE id = $1`, [backupId]);
    if (rows.length === 0) throw new NotFoundError('Backup');
    return rows[0];
  }

  static async restoreBackup(backupId: string): Promise<void> {
    const { rows } = await query(`SELECT * FROM backups WHERE id = $1`, [backupId]);
    if (rows.length === 0) throw new NotFoundError('Backup');

    const backup = rows[0];
    if (!backup.file_path || !(await fs.pathExists(backup.file_path))) {
      throw new AppError(404, 'BACKUP_FILE_MISSING', 'Backup file not found on disk.');
    }

    const { rows: servers } = await query(`SELECT * FROM servers WHERE id = $1`, [backup.server_id]);
    if (servers.length === 0) throw new NotFoundError('Server');

    const server = servers[0];

    if (server.status === 'running') {
      throw new AppError(400, 'INVALID_STATE', 'Stop the server before restoring a backup.');
    }

    await query(`UPDATE backups SET status = 'restoring' WHERE id = $1`, [backupId]);

    try {
      const serverPath = server.path || path.join(process.cwd(), '.data', 'servers', server.id);

      // Clear existing server data
      await fs.remove(serverPath);
      await fs.ensureDir(serverPath);

      // Extract backup
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(backup.file_path);
      zip.extractAllTo(serverPath, true);

      await query(`UPDATE backups SET status = 'completed' WHERE id = $1`, [backupId]);
      logger.info(`[BACKUP] Restored backup ${backupId} for server ${server.id}`);
    } catch (error: any) {
      await query(`UPDATE backups SET status = 'failed' WHERE id = $1`, [backupId]);
      throw new AppError(500, 'RESTORE_FAILED', `Restore failed: ${error.message}`);
    }
  }
}
