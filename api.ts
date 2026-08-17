import { Router } from 'express';
import { apiLimiter } from '../middleware/rateLimit.js';
import { successResponse } from '../utils/errors.js';

const router = Router();
router.use('/v1', apiLimiter);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', panel: 'CAVRIX Panel', version: '1.0.0', uptime: process.uptime() });
});

router.get('/ready', async (_req, res) => {
  try {
    const { checkDatabaseConnection } = await import('../database/pool.js');
    const dbOk = await checkDatabaseConnection();
    res.json({
      status: dbOk ? 'ready' : 'degraded',
      database: dbOk ? 'connected' : 'disconnected',
    });
  } catch {
    res.json({ status: 'degraded', database: 'error' });
  }
});

router.get('/version', (_req, res) => {
  res.json({ version: '1.0.0', name: 'CAVRIX Panel', codename: 'Phoenix' });
});

import authRoutes from './auth.js';
import serverRoutes from './servers.js';
import userRoutes from './users.js';
import roleRoutes from './roles.js';
import nodeRoutes from './nodes.js';
import fileRoutes from './files.js';
import backupRoutes from './backups.js';
import scheduleRoutes from './schedules.js';
import auditRoutes from './audit.js';
import settingsRoutes from './settings.js';
import consoleRoutes from './console.js';

router.use('/auth', authRoutes);
router.use('/servers', serverRoutes);
router.use('/admin/users', userRoutes);
router.use('/admin/roles', roleRoutes);
router.use('/nodes', nodeRoutes);
router.use('/files', fileRoutes);
router.use('/backups', backupRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/admin/audit', auditRoutes);
router.use('/settings', settingsRoutes);
router.use('/console', consoleRoutes);

export default router;
