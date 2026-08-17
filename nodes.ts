import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { NodeService } from '../services/nodeService.js';
import { TelemetryService } from '../services/telemetry.js';
import { successResponse } from '../utils/errors.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const nodes = await NodeService.listNodes();
    res.json(successResponse(nodes));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const node = await NodeService.getNode(req.params.id);
    res.json(successResponse(node));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/telemetry', async (req, res, next) => {
  try {
    const telemetry = await TelemetryService.getNodeTelemetry(req.params.id);
    res.json(successResponse(telemetry));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const node = await NodeService.createNode(req.body);
    res.status(201).json(successResponse(node));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    await NodeService.updateNode(req.params.id, req.body);
    res.json(successResponse(null, 'Node updated.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await NodeService.deleteNode(req.params.id);
    res.json(successResponse(null, 'Node deleted.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/heartbeat', requireAdmin, async (req, res, next) => {
  try {
    await NodeService.heartbeat(req.params.id, req.body);
    res.json(successResponse(null, 'Heartbeat recorded.'));
  } catch (error) {
    next(error);
  }
});

export default router;
