import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { DockerService } from '../services/docker.js';
import { successResponse } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

router.get('/:serverId/logs', requirePermission('server.console'), async (req, res, next) => {
  try {
    const { serverId } = req.params;
    const tail = parseInt((req.query.tail as string) || '200');

    const { rows } = await query(`SELECT container_id, runtime FROM servers WHERE id = $1`, [serverId]);
    if (rows.length === 0 || !rows[0].container_id) {
      return res.json(successResponse(''));
    }

    const logs = await DockerService.getContainerLogs(rows[0].container_id, tail);
    res.json(successResponse(logs));
  } catch (error) {
    next(error);
  }
});

export default router;
