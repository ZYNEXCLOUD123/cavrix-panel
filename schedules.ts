import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { ScheduleService } from '../services/scheduleService.js';
import { successResponse } from '../utils/errors.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/:serverId', requirePermission('server.settings'), async (req, res, next) => {
  try {
    const schedules = await ScheduleService.listSchedules(req.params.serverId);
    res.json(successResponse(schedules));
  } catch (error) {
    next(error);
  }
});

router.post('/:serverId', requirePermission('server.settings'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const schedule = await ScheduleService.createSchedule({
      server_id: req.params.serverId,
      ...req.body,
      created_by: authReq.user!.userId,
    });
    res.status(201).json(successResponse(schedule));
  } catch (error) {
    next(error);
  }
});

router.put('/:serverId/:scheduleId/toggle', requirePermission('server.settings'), async (req, res, next) => {
  try {
    await ScheduleService.toggleSchedule(req.params.scheduleId, req.body.is_active);
    res.json(successResponse(null, 'Schedule updated.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:serverId/:scheduleId', requirePermission('server.settings'), async (req, res, next) => {
  try {
    await ScheduleService.deleteSchedule(req.params.scheduleId);
    res.json(successResponse(null, 'Schedule deleted.'));
  } catch (error) {
    next(error);
  }
});

export default router;
