import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { FileManager } from '../services/fileManager.js';
import { successResponse } from '../utils/errors.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { query } from '../database/pool.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const upload = multer({
  dest: path.join(process.cwd(), '.data', 'temp'),
  limits: { fileSize: 100 * 1024 * 1024 },
});

async function getServerPath(serverId: string): Promise<string | null> {
  const { rows } = await query(`SELECT path FROM servers WHERE id = $1`, [serverId]);
  return rows[0]?.path || null;
}

router.get('/:serverId/list', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const dirPath = (req.query.path as string) || '.';
    const serverPath = await getServerPath(serverId);

    if (!serverPath) {
      return res.status(404).json(successResponse(null, 'Server not found'));
    }

    const fm = new FileManager(serverId, serverPath);
    const files = await fm.listDirectory(dirPath);
    res.json(successResponse(files));
  } catch (error) {
    next(error);
  }
});

router.get('/:serverId/read', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'File path required.' } });
    }

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    const content = await fm.readFile(filePath);
    res.json(successResponse({ content, path: filePath }));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId/write', requirePermission('server.files.write'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Path and content required.' } });
    }

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    await fm.writeFile(filePath, content);
    res.json(successResponse(null, 'File saved.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId/create', requirePermission('server.files.write'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { path: filePath, type } = req.body;

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    if (type === 'directory') {
      await fm.createDirectory(filePath);
    } else {
      await fm.createFile(filePath);
    }
    res.status(201).json(successResponse(null, 'Created.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:serverId/delete', requirePermission('server.files.write'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const filePath = req.body.path || req.query.path;

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    await fm.delete(filePath);
    res.json(successResponse(null, 'Deleted.'));
  } catch (error) {
    next(error);
  }
});

router.put('/:serverId/rename', requirePermission('server.files.write'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { oldPath, newPath } = req.body;

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    await fm.rename(oldPath, newPath);
    res.json(successResponse(null, 'Renamed.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId/copy', requirePermission('server.files.write'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const { source, destination } = req.body;

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    await fm.copy(source, destination);
    res.json(successResponse(null, 'Copied.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId/upload', requirePermission('server.files.write'), upload.array('files', 10), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const targetPath = (req.body.path as string) || '.';

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    const resolvedTarget = path.join(serverPath, targetPath);

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        const dest = path.join(resolvedTarget, file.originalname);
        await fs.move(file.path, dest, { overwrite: true });
      }
    }

    res.json(successResponse(null, 'Files uploaded.'));
  } catch (error) {
    next(error);
  }
});

router.get('/:serverId/download', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const filePath = req.query.path as string;

    if (!filePath) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Path required.' } });

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const fm = new FileManager(serverId, serverPath);
    const info = await fm.getFileInfo(filePath);

    const { sanitizePath } = await import('../utils/sanitize.js');
    const resolved = sanitizePath(filePath, serverPath);
    if (!resolved) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } });

    res.download(resolved, info.name);
  } catch (error) {
    next(error);
  }
});

router.get('/:serverId/search', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const query_str = req.query.q as string;

    const serverPath = await getServerPath(serverId);
    if (!serverPath) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Server not found.' } });

    const results: any[] = [];
    const { execSync } = await import('child_process');

    try {
      const output = execSync(
        `find "${serverPath}" -type f -name "*${query_str}*" 2>/dev/null | head -50`,
        { encoding: 'utf-8' }
      );
      const lines = output.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const relativePath = path.relative(serverPath, line).replace(/\\/g, '/');
        results.push({ path: relativePath, name: path.basename(line) });
      }
    } catch {}

    res.json(successResponse(results));
  } catch (error) {
    next(error);
  }
});

export default router;
