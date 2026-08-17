import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs-extra';

import { runMigrations } from './database/migrations.js';
import { checkDatabaseConnection } from './database/pool.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { ScheduleService } from './services/scheduleService.js';
import { TelemetryService } from './services/telemetry.js';
import { query } from './database/pool.js';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from './types/index.js';

import apiRoutes from './routes/api.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set('io', io);

// Middleware
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
}));
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Ensure data directories
const DATA_DIR = path.join(process.cwd(), '.data');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(path.join(DATA_DIR, 'servers'));
fs.ensureDirSync(path.join(DATA_DIR, 'temp'));
fs.ensureDirSync(path.join(process.cwd(), 'backups'));

// API Routes
app.use('/api', apiRoutes);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(process.cwd(), 'frontend', 'dist');
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(frontendPath, 'index.html'));
    });
  }
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// WebSocket authentication
const JWT_SECRET = process.env.JWT_SECRET || 'cavrix-default-secret-change-me';

io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.query.token;
  if (!token) return next(new Error('Authentication required'));

  try {
    const decoded = jwt.verify(String(token), JWT_SECRET) as JwtPayload;
    (socket as any).user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

// WebSocket connections
io.on('connection', (socket) => {
  const user = (socket as any).user as JwtPayload;
  logger.debug(`[WS] Connected: ${user.username} (${socket.id})`);

  socket.on('join:server', async (serverId: string) => {
    // Verify access
    try {
      const { rows: roles } = await query<{ name: string }>(
        `SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = $1 ORDER BY r.priority DESC`,
        [user.userId]
      );

      const topRole = roles[0]?.name;
      let hasAccess = topRole === 'OWNER' || topRole === 'ADMIN';

      if (!hasAccess) {
        const { rows: server } = await query(`SELECT owner_id FROM servers WHERE id = $1`, [serverId]);
        hasAccess = server[0]?.owner_id === user.userId;

        if (!hasAccess) {
          const { rows: subUser } = await query(
            `SELECT 1 FROM server_permissions WHERE server_id = $1 AND user_id = $2`,
            [serverId, user.userId]
          );
          hasAccess = subUser.length > 0;
        }
      }

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied.' });
        return;
      }

      socket.join(`server:${serverId}`);
      socket.emit('joined:server', { serverId });

      // Send recent logs
      try {
        const { DockerService } = await import('./services/docker.js');
        const { rows } = await query(`SELECT container_id FROM servers WHERE id = $1`, [serverId]);
        if (rows[0]?.container_id) {
          const logs = await DockerService.getContainerLogs(rows[0].container_id, 100);
          if (logs) socket.emit('console:log', { serverId, data: logs });
        }
      } catch {}
    } catch (err) {
      logger.error(`[WS] Join server error: ${err}`);
    }
  });

  socket.on('leave:server', (serverId: string) => {
    socket.leave(`server:${serverId}`);
  });

  socket.on('console:command', async (data: { serverId: string; command: string }) => {
    try {
      const { DockerService } = await import('./services/docker.js');
      const { rows } = await query(`SELECT container_id, runtime FROM servers WHERE id = $1`, [data.serverId]);

      if (rows.length === 0 || !rows[0].container_id) {
        socket.emit('console:error', { message: 'Server not running.' });
        return;
      }

      if (rows[0].runtime === 'docker') {
        const container = (DockerService as any);
        // For Docker exec
        const Dockerode = (await import('dockerode')).default;
        const docker = new Dockerode({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
        const c = docker.getContainer(rows[0].container_id);

        await c.exec({
          Cmd: ['rcon-cli', data.command],
          AttachStdout: true,
          AttachStderr: true,
        }).then(async (exec: any) => {
          const stream = await exec.start({ Detach: false });
          stream.on('data', (chunk: Buffer) => {
            socket.emit('console:log', { serverId: data.serverId, data: chunk.toString() });
          });
        }).catch(async () => {
          // Fallback: use docker exec
          const { execSync } = await import('child_process');
          try {
            execSync(`docker exec ${rows[0].container_id.substring(0, 12)} rcon-cli "${data.command.replace(/"/g, '\\"')}"`, { encoding: 'utf-8', timeout: 10000 });
          } catch {}
        });
      }

      socket.emit('console:sent', { serverId: data.serverId, command: data.command });
    } catch (err: any) {
      socket.emit('console:error', { message: err.message });
    }
  });

  socket.on('telemetry:request', async () => {
    try {
      const data = TelemetryService.getSystemTelemetry();
      socket.emit('telemetry:data', data);
    } catch {}
  });

  socket.on('disconnect', () => {
    logger.debug(`[WS] Disconnected: ${user.username}`);
  });
});

// Telemetry broadcast
setInterval(() => {
  try {
    const data = TelemetryService.getSystemTelemetry();
    io.emit('telemetry:data', data);
  } catch {}
}, parseInt(process.env.TELEMETRY_INTERVAL || '5000'));

// Start
const PORT = parseInt(process.env.PORT || '3000');

async function start() {
  try {
    // Check database
    const dbOk = await checkDatabaseConnection();
    if (!dbOk) {
      logger.error('Database connection failed. Please check your configuration.');
      process.exit(1);
    }

    // Run migrations
    await runMigrations();

    // Load schedules
    await ScheduleService.loadAllSchedules();

    // Start HTTP server
    httpServer.listen(PORT, process.env.HOST || '0.0.0.0', () => {
      logger.info(`CAVRIX Panel v1.0.0 running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error: any) {
    logger.error(`Failed to start CAVRIX Panel: ${error.message}`);
    process.exit(1);
  }
}

start();

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.stack}`);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

export { app, io, httpServer };
