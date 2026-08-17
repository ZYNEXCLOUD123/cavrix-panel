import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/pool.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { successResponse } from '../utils/errors.js';
import { UnauthorizedError, ConflictError, NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import type { JwtPayload } from '../types/index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'cavrix-default-secret-change-me';
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

const registerSchema = z.object({
  body: z.object({
    username: z.string().min(3).max(64).regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    password: z.string().min(8).max(128),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

function generateToken(user: { id: string; email: string; username: string; is_admin: boolean }): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    username: user.username,
    is_admin: user.is_admin,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { rows } = await query(
      `SELECT id, username, email, password_hash, is_admin, status FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const user = rows[0];

    if (user.status !== 'active') {
      throw new ForbiddenError('Account is suspended or banned.');
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    await query(`UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2`, [
      req.ip || 'unknown',
      user.id,
    ]);

    const token = generateToken(user);

    res.cookie('cavrix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json(successResponse({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
      },
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/register', authLimiter, validate(registerSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const settingsResult = await query(`SELECT value FROM panel_settings WHERE key = 'allow_registration'`);
    const allowRegistration = settingsResult.rows[0]?.value !== 'false';

    if (!allowRegistration) {
      throw new ForbiddenError('Registration is currently disabled.');
    }

    const existingUser = await query(
      `SELECT id FROM users WHERE email = $1 OR username = $2 LIMIT 1`,
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      throw new ConflictError('Email or username already in use.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = (await import('uuid')).v4();

    await query(
      `INSERT INTO users (id, username, email, password_hash, status) VALUES ($1, $2, $3, $4, 'active')`,
      [userId, username, email, passwordHash]
    );

    const { rows: defaultRole } = await query<{ id: string }>(
      `SELECT id FROM roles WHERE is_default = true LIMIT 1`
    );
    if (defaultRole.length > 0) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [
        userId,
        defaultRole[0].id,
      ]);
    }

    const token = generateToken({ id: userId, email, username, is_admin: false });

    res.cookie('cavrix_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json(successResponse({
      token,
      user: { id: userId, username, email, is_admin: false },
    }));
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { rows } = await query(
      `SELECT id, username, email, avatar, status, is_admin, two_factor_enabled, last_login_at, created_at
       FROM users WHERE id = $1`,
      [authReq.user!.userId]
    );

    if (rows.length === 0) {
      throw new NotFoundError('User');
    }

    const user = rows[0];

    const { rows: roles } = await query(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1`,
      [user.id]
    );

    const { rows: permissions } = await query(
      `SELECT DISTINCT p.key FROM permissions p
       JOIN role_permissions rp ON rp.permission_id = p.id
       JOIN user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    res.json(successResponse({
      ...user,
      roles: roles.map((r: any) => r.name),
      permissions: permissions.map((p: any) => p.key),
    }));
  } catch (error) {
    next(error);
  }
});

router.post('/logout', authenticate, async (_req, res) => {
  res.clearCookie('cavrix_token');
  res.json(successResponse(null, 'Logged out successfully.'));
});

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Current and new passwords are required.');
    }

    if (newPassword.length < 8) {
      throw new AppError(400, 'VALIDATION_ERROR', 'New password must be at least 8 characters.');
    }

    const { rows } = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [authReq.user!.userId]
    );

    if (rows.length === 0 || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      throw new UnauthorizedError('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      newHash,
      authReq.user!.userId,
    ]);

    res.json(successResponse(null, 'Password changed successfully.'));
  } catch (error) {
    next(error);
  }
});

export default router;
