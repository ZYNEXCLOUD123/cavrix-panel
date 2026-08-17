import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { successResponse } from '../utils/errors.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { page = '1', limit = '50', action, user_id } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (action) {
      params.push(action);
      whereClause += ` AND al.action = $${params.length}`;
    }
    if (user_id) {
      params.push(user_id);
      whereClause += ` AND al.user_id = $${params.length}`;
    }

    const { rows: logs } = await query(
      `SELECT al.*, u.username, u.email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${whereClause}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );

    const { rows: countResult } = await query(
      `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`,
      params
    );

    res.json(successResponse({
      logs,
      total: parseInt(countResult[0].total),
      page: parseInt(page),
      limit: parseInt(limit),
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
