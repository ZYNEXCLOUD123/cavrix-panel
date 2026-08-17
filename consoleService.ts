import { Server as SocketIOServer } from 'socket.io';
import { query } from '../database/pool.js';
import { DockerService } from './docker.js';
import { logger } from '../utils/logger.js';

export class ConsoleService {
  private static attachedServers = new Map<string, boolean>();

  static attachToServer(io: SocketIOServer, serverId: string, containerId: string): void {
    if (this.attachedServers.has(serverId)) return;
    this.attachedServers.set(serverId, true);

    logger.info(`[CONSOLE] Attaching to server ${serverId}`);

    // Monitor container status
    const checkInterval = setInterval(async () => {
      const status = await DockerService.getContainerStatus(containerId);
      if (!status || status === 'exited' || status === 'dead') {
        clearInterval(checkInterval);
        this.attachedServers.delete(serverId);

        await query(
          `UPDATE servers SET status = 'stopped', last_stop_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [serverId]
        );

        io.to(`server:${serverId}`).emit('console:log', {
          serverId,
          data: '\n[CAVRIX] Server process has stopped.\n',
        });

        logger.info(`[CONSOLE] Server ${serverId} process ended`);
      }
    }, 10000);

    // Stream logs periodically
    const logInterval = setInterval(async () => {
      try {
        const logs = await DockerService.getContainerLogs(containerId, 50);
        if (logs.trim()) {
          io.to(`server:${serverId}`).emit('console:log', { serverId, data: logs });
        }
      } catch {}
    }, 3000);

    // Cleanup after 24 hours
    setTimeout(() => {
      clearInterval(checkInterval);
      clearInterval(logInterval);
      this.attachedServers.delete(serverId);
    }, 24 * 60 * 60 * 1000);
  }

  static detachFromServer(serverId: string): void {
    this.attachedServers.delete(serverId);
  }

  static async sendCommand(containerId: string, command: string): Promise<string> {
    try {
      const { execSync } = await import('child_process');
      const result = execSync(
        `docker exec ${containerId.substring(0, 12)} rcon-cli "${command.replace(/"/g, '\\"')}"`,
        { encoding: 'utf-8', timeout: 30000 }
      );
      return result;
    } catch (error: any) {
      logger.error(`[CONSOLE] Command failed: ${error.message}`);
      return `Error: ${error.message}`;
    }
  }
}
