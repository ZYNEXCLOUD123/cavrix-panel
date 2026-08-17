import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/pool.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { successResponse, NotFoundError, ConflictError, AppError } from '../utils/errors.js';
import type { AuthRequest } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, username, email, avatar, status, is_admin, last_login_at, created_at
       FROM users ORDER BY created_at DESC`
    );

    const usersWithRoles = await Promise.all(
      rows.map(async (user: any) => {
        const { rows: roles } = await query(
          `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`,
          [user.id]
        );
        return { ...user, roles: roles.map((r: any) => r.name) };
      })
    );

    res.json(successResponse(usersWithRoles));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { username, email, password, is_admin = false } = req.body;

    if (!username || !email || !password) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Username, email, and password are required.');
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1 OR username = $2`, [email, username]);
    if (existing.rows.length > 0) {
      throw new ConflictError('Email or username already in use.');
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await query(
      `INSERT INTO users (id, username, email, password_hash, is_admin, status) VALUES ($1, $2, $3, $4, $5, 'active')`,
      [id, username, email, passwordHash, is_admin]
    );

    const { rows: defaultRole } = await query<{ id: string }>(
      `SELECT id FROM roles WHERE is_default = true LIMIT 1`
    );
    if (defaultRole.length > 0) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [id, defaultRole[0].id]);
    }

    res.status(201).json(successResponse({ id, username, email, is_admin }));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { username, email, status, is_admin } = req.body;

    const { rows: existing } = await query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (existing.length === 0) throw new NotFoundError('User');

    if (username) {
      const dup = await query(`SELECT id FROM users WHERE username = $1 AND id != $2`, [username, id]);
      if (dup.rows.length > 0) throw new ConflictError('Username already in use.');
    }

    await query(
      `UPDATE users SET
        username = COALESCE($1, username),
        email = COALESCE($2, email),
        status = COALESCE($3, status),
        is_admin = COALESCE($4, is_admin),
        updated_at = NOW()
       WHERE id = $5`,
      [username, email, status, is_admin, id]
    );

    res.json(successResponse(null, 'User updated.'));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authReq = req as AuthRequest;

    if (id === authReq.user!.userId) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Cannot delete your own account.');
    }

    const { rows: existing } = await query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (existing.length === 0) throw new NotFoundError('User');

    await query(`DELETE FROM users WHERE id = $1`, [id]);
    res.json(successResponse(null, 'User deleted.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Password must be at least 8 characters.');
    }

    const { rows } = await query(`SELECT id FROM users WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('User');

    const hash = await bcrypt.hash(password, 12);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [hash, id]);

    res.json(successResponse(null, 'Password reset successfully.'));
  } catch (error) {
    next(error);
  }
});

export default router;
