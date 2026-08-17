import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { successResponse, NotFoundError, ConflictError, AppError } from '../utils/errors.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { rows: roles } = await query(`SELECT * FROM roles ORDER BY priority DESC`);

    const rolesWithPerms = await Promise.all(
      roles.map(async (role: any) => {
        const { rows: perms } = await query(
          `SELECT p.key, p.description, p.category FROM permissions p
           JOIN role_permissions rp ON rp.permission_id = p.id WHERE rp.role_id = $1`,
          [role.id]
        );
        return { ...role, permissions: perms };
      })
    );

    res.json(successResponse(rolesWithPerms));
  } catch (error) {
    next(error);
  }
});

router.get('/permissions', async (_req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM permissions ORDER BY category, key`);
    res.json(successResponse(rows));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name, description, priority = 0, permission_keys = [] } = req.body;

    if (!name) throw new AppError(400, 'VALIDATION_ERROR', 'Role name is required.');

    const existing = await query(`SELECT id FROM roles WHERE name = $1`, [name]);
    if (existing.rows.length > 0) throw new ConflictError('Role name already exists.');

    const id = uuidv4();
    await query(
      `INSERT INTO roles (id, name, description, priority) VALUES ($1, $2, $3, $4)`,
      [id, name, description, priority]
    );

    if (permission_keys.length > 0) {
      const { rows: perms } = await query<{ id: string }>(
        `SELECT id FROM permissions WHERE key = ANY($1)`,
        [permission_keys]
      );
      for (const perm of perms) {
        await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
          id,
          perm.id,
        ]);
      }
    }

    res.status(201).json(successResponse({ id, name }));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, priority, permission_keys } = req.body;

    const { rows } = await query(`SELECT id FROM roles WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('Role');

    await query(
      `UPDATE roles SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        priority = COALESCE($3, priority)
       WHERE id = $4`,
      [name, description, priority, id]
    );

    if (Array.isArray(permission_keys)) {
      await query(`DELETE FROM role_permissions WHERE role_id = $1`, [id]);
      if (permission_keys.length > 0) {
        const { rows: perms } = await query<{ id: string }>(
          `SELECT id FROM permissions WHERE key = ANY($1)`,
          [permission_keys]
        );
        for (const perm of perms) {
          await query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`, [id, perm.id]);
        }
      }
    }

    res.json(successResponse(null, 'Role updated.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows } = await query(`SELECT id, is_default FROM roles WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('Role');

    if (rows[0].is_default) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot delete the default role.');
    }

    await query(`DELETE FROM roles WHERE id = $1`, [id]);
    res.json(successResponse(null, 'Role deleted.'));
  } catch (error) {
    next(error);
  }
});

export default router;
