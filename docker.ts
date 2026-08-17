import Dockerode from 'dockerode';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import type { Server } from '../types/index.js';

const dockerSocket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

let docker: Dockerode | null = null;

function getDocker(): Dockerode {
  if (!docker) {
    docker = new Dockerode({ socketPath: dockerSocket });
  }
  return docker;
}

export class DockerService {
  static async startServer(server: Server): Promise<string | null> {
    const d = getDocker();

    const envVars: string[] = [
      `EULA=TRUE`,
      `SERVER_PORT=25565`,
      `MEMORY=${server.ram_limit}M`,
      `TYPE=${server.server_type?.toUpperCase() || 'PAPER'}`,
      `JAVA_VERSION=${server.java_version || 21}`,
      `DIFFICULTY=easy`,
      `ONLINE_MODE=true`,
      `ENABLE_COMMAND_BLOCK=true`,
      `SPAWN_PROTECTION=0`,
      `MAX_PLAYERS=20`,
      `VIEW_DISTANCE=10`,
      `SIMULATION_DISTANCE=10`,
    ];

    // Add custom environment variables
    if (server.environment && typeof server.environment === 'object') {
      for (const [key, value] of Object.entries(server.environment as Record<string, string>)) {
        envVars.push(`${key}=${value}`);
      }
    }

    const containerName = `cavrix-server-${server.id.substring(0, 8)}`;

    try {
      // Remove existing container if any
      try {
        const existing = d.getContainer(containerName);
        const info = await existing.inspect().catch(() => null);
        if (info) {
          if (info.State.Running) {
            await existing.stop();
          }
          await existing.remove({ force: true });
        }
      } catch {}

      const imageMap: Record<string, string> = {
        paper: 'itzg/minecraft-server',
        purpur: 'itzg/minecraft-server',
        spigot: 'itzg/minecraft-server',
        vanilla: 'itzg/minecraft-server',
        fabric: 'itzg/minecraft-server',
        forge: 'itzg/minecraft-server',
        neoforge: 'itzg/minecraft-server',
      };

      const image = imageMap[server.server_type] || 'itzg/minecraft-server';

      // Pull image if not available
      try {
        await d.getImage(image).inspect();
      } catch {
        logger.info(`[DOCKER] Pulling image: ${image}`);
        await new Promise<void>((resolve, reject) => {
          d.pull(image, (err: any, stream: any) => {
            if (err) return reject(err);
            d.modem.followProgress(stream, (err: any) => {
              if (err) reject(err);
              else resolve();
            });
          });
        });
      }

      const dataDir = server.path || `${process.cwd()}/.data/servers/${server.id}`;

      const container = await d.createContainer({
        name: containerName,
        Image: image,
        Env: envVars,
        ExposedPorts: { '25565/tcp': {} },
        HostConfig: {
          PortBindings: {
            '25565/tcp': [{ HostPort: String(server.allocated_port), HostIp: '0.0.0.0' }],
          },
          Binds: [`${dataDir}:/data`],
          Memory: server.ram_limit * 1024 * 1024,
          MemorySwap: (server.ram_limit + (server.swap_limit || 0)) * 1024 * 1024,
          CpuPeriod: 100000,
          CpuQuota: Math.round(server.cpu_limit * 1000),
          RestartPolicy: { Name: 'unless-stopped' },
          NetworkMode: 'bridge',
          Privileged: false,
          SecurityOpt: ['no-new-privileges'],
          ReadonlyRootfs: false,
          LogConfig: { Type: 'json-file', Config: { 'max-size': '10m', 'max-file': '3' } },
        },
        WorkingDir: '/data',
        Labels: { 'cavrix.panel': 'true', 'cavrix.server.id': server.id },
      });

      await container.start();

      const inspectInfo = await container.inspect();
      const containerId = inspectInfo.Id;

      await query(`UPDATE servers SET container_id = $1, status = 'running', last_start_at = NOW(), updated_at = NOW() WHERE id = $2`, [
        containerId,
        server.id,
      ]);

      logger.info(`[DOCKER] Container started: ${containerName} (${containerId.substring(0, 12)})`);
      return containerId;
    } catch (error: any) {
      logger.error(`[DOCKER] Failed to start server ${server.id}: ${error.message}`);
      await query(`UPDATE servers SET status = 'crashed', updated_at = NOW() WHERE id = $1`, [server.id]);
      return null;
    }
  }

  static async stopContainer(containerId: string): Promise<void> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      await container.stop({ t: 15 });
      logger.info(`[DOCKER] Container stopped: ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      if (error.statusCode !== 304) {
        logger.error(`[DOCKER] Failed to stop container: ${error.message}`);
      }
    }
  }

  static async restartContainer(containerId: string): Promise<void> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      await container.restart({ t: 15 });
      logger.info(`[DOCKER] Container restarted: ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      logger.error(`[DOCKER] Failed to restart container: ${error.message}`);
    }
  }

  static async killContainer(containerId: string): Promise<void> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      await container.kill();
      logger.info(`[DOCKER] Container killed: ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      if (error.statusCode !== 304) {
        logger.error(`[DOCKER] Failed to kill container: ${error.message}`);
      }
    }
  }

  static async removeContainer(containerId: string): Promise<void> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      await container.remove({ force: true, v: false });
      logger.info(`[DOCKER] Container removed: ${containerId.substring(0, 12)}`);
    } catch (error: any) {
      logger.error(`[DOCKER] Failed to remove container: ${error.message}`);
    }
  }

  static async getContainerStatus(containerId: string): Promise<string | null> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch {
      return null;
    }
  }

  static async getContainerStats(containerId: string): Promise<any> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      return {
        cpu: {
          usage: stats.cpu_stats.cpu_usage.total_usage,
          system: stats.cpu_stats.system_cpu_usage,
          cores: stats.cpu_stats.online_cpus,
        },
        memory: {
          usage: stats.memory_stats.usage || 0,
          limit: stats.memory_stats.limit || 0,
        },
        network: stats.networks || {},
      };
    } catch {
      return null;
    }
  }

  static async getContainerLogs(containerId: string, tail = 100): Promise<string> {
    const d = getDocker();
    try {
      const container = d.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logs.toString('utf-8');
    } catch {
      return '';
    }
  }

  static async listServerContainers(): Promise<any[]> {
    const d = getDocker();
    try {
      const containers = await d.listContainers({
        all: true,
        filters: { label: ['cavrix.panel=true'] },
      });
      return containers.map((c) => ({
        id: c.Id,
        name: c.Names[0]?.replace('/', ''),
        image: c.Image,
        state: c.State,
        status: c.Status,
        created: c.Created,
        ports: c.Ports,
        labels: c.Labels,
      }));
    } catch {
      return [];
    }
  }

  static async getSystemDockerStats(): Promise<{ total: number; running: number; stopped: number }> {
    const containers = await this.listServerContainers();
    return {
      total: containers.length,
      running: containers.filter((c) => c.state === 'running').length,
      stopped: containers.filter((c) => c.state !== 'running').length,
    };
  }
}
