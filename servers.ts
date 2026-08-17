import { Router } from 'express';
import { query } from '../database/pool.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { successResponse, NotFoundError, ForbiddenError, AppError } from '../utils/errors.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { DockerService } from '../services/docker.js';
import type { AuthRequest } from '../middleware/auth.js';
import path from 'path';
import fs from 'fs-extra';

const router = Router();
router.use(authenticate);

const createServerSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(128),
    description: z.string().max(500).optional(),
    game_type: z.string().default('minecraft'),
    server_type: z.string().default('paper'),
    node_id: z.string().uuid().nullable().optional(),
    cpu_limit: z.number().min(0.5).max(1024).default(100),
    ram_limit: z.number().min(128).default(2048),
    disk_limit: z.number().min(1024).default(10240),
    allocated_port: z.number().min(1).max(65535).default(25565),
    java_version: z.number().default(21),
  }),
  query: z.object({}).passthrough(),
  params: z.object({}).passthrough(),
});

// Helper: check if user can access a server
async function canAccessServer(userId: string, serverId: string): Promise<any> {
  const { rows } = await query(
    `SELECT * FROM servers WHERE id = $1`,
    [serverId]
  );
  if (rows.length === 0) return null;

  const server = rows[0];

  const { rows: roles } = await query<{ name: string }>(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1 ORDER BY r.priority DESC`,
    [userId]
  );

  const topRole = roles[0]?.name;

  if (topRole === 'OWNER' || topRole === 'ADMIN' || server.owner_id === userId) {
    return server;
  }

  // Check sub-user access
  const { rows: subUser } = await query(
    `SELECT 1 FROM server_permissions WHERE server_id = $1 AND user_id = $2`,
    [serverId, userId]
  );

  return subUser.length > 0 ? server : null;
}

// List servers
router.get('/', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const { rows: roles } = await query<{ name: string }>(
      `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 ORDER BY r.priority DESC`,
      [userId]
    );

    const topRole = roles[0]?.name;
    let servers;

    if (topRole === 'OWNER' || topRole === 'ADMIN') {
      const result = await query(
        `SELECT s.*, u.username as owner_name FROM servers s
         LEFT JOIN users u ON u.id = s.owner_id
         ORDER BY s.created_at DESC`
      );
      servers = result.rows;
    } else {
      const result = await query(
        `SELECT s.*, u.username as owner_name FROM servers s
         LEFT JOIN users u ON u.id = s.owner_id
         WHERE s.owner_id = $1
         ORDER BY s.created_at DESC`,
        [userId]
      );
      servers = result.rows;
    }

    res.json(successResponse(servers));
  } catch (error) {
    next(error);
  }
});

// Get single server
router.get('/:id', async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);

    if (!server) {
      throw new NotFoundError('Server');
    }

    // Get node info if assigned
    let node = null;
    if (server.node_id) {
      const { rows } = await query(`SELECT id, name, hostname, ip_address, status FROM nodes WHERE id = $1`, [server.node_id]);
      node = rows[0] || null;
    }

    res.json(successResponse({ ...server, node }));
  } catch (error) {
    next(error);
  }
});

// Create server
router.post('/', requirePermission('server.create'), validate(createServerSchema), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const data = req.body;
    const id = uuidv4();

    const serverPath = path.join(process.cwd(), '.data', 'servers', id);
    await fs.ensureDir(serverPath);

    // Determine default startup command based on server type
    let startupCommand = data.startup_command;
    if (!startupCommand) {
      const jarName = getJarName(data.server_type);
      startupCommand = `java -Xms${data.ram_limit}M -Xmx${data.ram_limit}M -jar ${jarName} nogui`;
    }

    await query(
      `INSERT INTO servers (id, name, description, owner_id, node_id, game_type, server_type,
        cpu_limit, ram_limit, disk_limit, allocated_port, java_version, startup_command, path, runtime, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'stopped')`,
      [
        id, data.name, data.description || null, authReq.user!.userId,
        data.node_id || null, data.game_type, data.server_type,
        data.cpu_limit, data.ram_limit, data.disk_limit,
        data.allocated_port, data.java_version,
        startupCommand, serverPath, 'docker',
      ]
    );

    const { rows } = await query(`SELECT * FROM servers WHERE id = $1`, [id]);

    // Create allocation
    if (data.node_id) {
      await query(
        `INSERT INTO allocations (node_id, ip_address, port, server_id) VALUES ($1, '0.0.0.0', $2, $3) ON CONFLICT DO NOTHING`,
        [data.node_id, data.allocated_port, id]
      );
    }

    // Audit log
    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_CREATE', 'server', $2, $3)`,
      [authReq.user!.userId, id, req.ip]
    );

    res.status(201).json(successResponse(rows[0]));
  } catch (error) {
    next(error);
  }
});

// Delete server
router.delete('/:id', requirePermission('server.delete'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    // Stop container if running
    if (server.container_id && server.runtime === 'docker') {
      try {
        await DockerService.stopContainer(server.container_id);
        await DockerService.removeContainer(server.container_id);
      } catch {}
    }

    // Remove allocation
    await query(`UPDATE allocations SET server_id = NULL WHERE server_id = $1`, [server.id]);

    // Delete server data directory
    if (server.path) {
      await fs.remove(server.path).catch(() => {});
    }

    await query(`DELETE FROM servers WHERE id = $1`, [server.id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_DELETE', 'server', $2, $3)`,
      [authReq.user!.userId, server.id, req.ip]
    );

    res.json(successResponse(null, 'Server deleted.'));
  } catch (error) {
    next(error);
  }
});

// Start server
router.post('/:id/start', requirePermission('server.start'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    if (server.status === 'running' || server.status === 'starting') {
      throw new AppError(400, 'INVALID_STATE', 'Server is already running or starting.');
    }

    if (server.status === 'suspended') {
      throw new ForbiddenError('Cannot start a suspended server.');
    }

    await query(`UPDATE servers SET status = 'starting', updated_at = NOW() WHERE id = $1`, [server.id]);

    // Start Docker container or local process
    if (server.runtime === 'docker' && process.env.ENABLE_DOCKER !== 'false') {
      DockerService.startServer(server).catch((err: any) => {
        console.error(`[CAVRIX] Failed to start server ${server.id}:`, err);
        query(`UPDATE servers SET status = 'crashed', updated_at = NOW() WHERE id = $1`, [server.id]);
      });
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_START', 'server', $2, $3)`,
      [authReq.user!.userId, server.id, req.ip]
    );

    res.json(successResponse(null, 'Server starting.'));
  } catch (error) {
    next(error);
  }
});

// Stop server
router.post('/:id/stop', requirePermission('server.stop'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    if (server.status !== 'running' && server.status !== 'starting') {
      throw new AppError(400, 'INVALID_STATE', 'Server is not running.');
    }

    await query(`UPDATE servers SET status = 'stopping', updated_at = NOW() WHERE id = $1`, [server.id]);

    if (server.container_id && server.runtime === 'docker') {
      DockerService.stopContainer(server.container_id).catch(() => {});
    }

    await query(`UPDATE servers SET status = 'stopped', last_stop_at = NOW(), updated_at = NOW() WHERE id = $1`, [server.id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_STOP', 'server', $2, $3)`,
      [authReq.user!.userId, server.id, req.ip]
    );

    res.json(successResponse(null, 'Server stopped.'));
  } catch (error) {
    next(error);
  }
});

// Restart server
router.post('/:id/restart', requirePermission('server.restart'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    if (server.container_id && server.runtime === 'docker') {
      DockerService.restartContainer(server.container_id).catch(() => {});
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_RESTART', 'server', $2, $3)`,
      [authReq.user!.userId, server.id, req.ip]
    );

    res.json(successResponse(null, 'Server restarting.'));
  } catch (error) {
    next(error);
  }
});

// Kill server
router.post('/:id/kill', requirePermission('server.stop'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    if (server.container_id && server.runtime === 'docker') {
      DockerService.killContainer(server.container_id).catch(() => {});
    }

    await query(`UPDATE servers SET status = 'stopped', last_stop_at = NOW(), updated_at = NOW() WHERE id = $1`, [server.id]);

    await query(
      `INSERT INTO audit_logs (user_id, action, target_type, target_id, ip_address) VALUES ($1, 'SERVER_KILL', 'server', $2, $3)`,
      [authReq.user!.userId, server.id, req.ip]
    );

    res.json(successResponse(null, 'Server killed.'));
  } catch (error) {
    next(error);
  }
});

// Update server settings
router.put('/:id', requirePermission('server.settings'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    const { name, description, cpu_limit, ram_limit, disk_limit, java_version, startup_command, jvm_args, environment } = req.body;

    await query(
      `UPDATE servers SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        cpu_limit = COALESCE($3, cpu_limit),
        ram_limit = COALESCE($4, ram_limit),
        disk_limit = COALESCE($5, disk_limit),
        java_version = COALESCE($6, java_version),
        startup_command = COALESCE($7, startup_command),
        jvm_args = COALESCE($8, jvm_args),
        environment = COALESCE($9, environment),
        updated_at = NOW()
       WHERE id = $10`,
      [name, description, cpu_limit, ram_limit, disk_limit, java_version, startup_command, jvm_args,
       environment ? JSON.stringify(environment) : null, req.params.id]
    );

    res.json(successResponse(null, 'Server updated.'));
  } catch (error) {
    next(error);
  }
});

// Suspend/Unsuspend
router.post('/:id/suspend', requirePermission('server.settings'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    if (server.container_id && server.runtime === 'docker') {
      await DockerService.stopContainer(server.container_id).catch(() => {});
    }

    await query(`UPDATE servers SET status = 'suspended', updated_at = NOW() WHERE id = $1`, [server.id]);
    res.json(successResponse(null, 'Server suspended.'));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/unsuspend', requirePermission('server.settings'), async (req, res, next) => {
  try {
    const authReq = req as AuthRequest;
    const server = await canAccessServer(authReq.user!.userId, req.params.id);
    if (!server) throw new NotFoundError('Server');

    await query(`UPDATE servers SET status = 'stopped', updated_at = NOW() WHERE id = $1`, [server.id]);
    res.json(successResponse(null, 'Server unsuspended.'));
  } catch (error) {
    next(error);
  }
});

function getJarName(serverType: string): string {
  const jarMap: Record<string, string> = {
    vanilla: 'server.jar',
    paper: 'paper.jar',
    purpur: 'purpur.jar',
    spigot: 'spigot.jar',
    fabric: 'fabric-server-launch.jar',
    forge: 'forge.jar',
    neoforge: 'neoforge.jar',
  };
  return jarMap[serverType] || 'server.jar';
}

export default router;
