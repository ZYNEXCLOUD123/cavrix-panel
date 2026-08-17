import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { query } from '../database/pool.js';
import type { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'cavrix-default-secret-change-me';

export interface AuthRequest extends Request {
  user?: JwtPayload;
  permissions?: string[];
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const cookieToken = (req as any).cookies?.cavrix_token;

    let token: string | undefined;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      throw new UnauthorizedError();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid or expired token.'));
    }
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  if (!authReq.user) {
    return next(new UnauthorizedError());
  }
  if (!authReq.user.is_admin) {
    return next(new ForbiddenError('Admin access required.'));
  }
  next();
}

export function requirePermission(...permissionKeys: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user) {
        return next(new UnauthorizedError());
      }

      // Admins have all permissions
      if (authReq.user.is_admin) {
        return next();
      }

      const { rows: userRoles } = await query<{ role_id: string }>(
        `SELECT role_id FROM user_roles WHERE user_id = $1`,
        [authReq.user.userId]
      );

      if (userRoles.length === 0) {
        return next(new ForbiddenError('No roles assigned.'));
      }

      const roleIds = userRoles.map((r) => r.role_id);
      const { rows } = await query<{ key: string }>(
        `SELECT DISTINCT p.key FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = ANY($1) AND p.key = ANY($2)`,
        [roleIds, permissionKeys]
      );

      if (rows.length === 0) {
        return next(new ForbiddenError(`Missing permission: ${permissionKeys.join(' or ')}`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
