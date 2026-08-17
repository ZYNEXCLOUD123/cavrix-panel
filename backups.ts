import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { BackupService } from '../services/backupService.js';
import { successResponse } from '../utils/errors.js';
import { query } from '../database/pool.js';

const router = Router();
router.use(authenticate);

router.get('/:serverId', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const backups = await BackupService.listBackups(req.params.serverId);
    res.json(successResponse(backups));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId', requirePermission('server.backup.create'), async (req, res, next) => {
  try {
    const backup = await BackupService.createBackup(req.params.serverId);
    res.status(201).json(successResponse(backup));
  } catch (error) {
    next(error);
  }
});

router.get('/:serverId/:backupId', requirePermission('server.files.read'), async (req, res, next) => {
  try {
    const backup = await BackupService.getBackup(req.params.backupId);
    res.json(successResponse(backup));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId/:backupId/restore', requirePermission('server.backup.restore'), async (req, res, next) => {
  try {
    await BackupService.restoreBackup(req.params.backupId);
    res.json(successResponse(null, 'Backup restored.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:serverId/:backupId', requirePermission('server.backup.create'), async (req, res, next) => {
  try {
    await BackupService.deleteBackup(req.params.backupId);
    res.json(successResponse(null, 'Backup deleted.'));
  } catch (error) {
    next(error);
  }
});

export default router;
