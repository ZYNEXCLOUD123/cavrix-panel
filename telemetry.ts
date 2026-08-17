import os from 'os';
import { query } from '../database/pool.js';
import { DockerService } from './docker.js';
import { logger } from '../utils/logger.js';
import type { TelemetryData } from '../types/index.js';

export class TelemetryService {
  private static cpuSamples: number[] = [];
  private static staticInfo: any = null;

  static getStaticInfo(): any {
    if (this.staticInfo) return this.staticInfo;
    this.staticInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      uptime: os.uptime(),
    };
    return this.staticInfo;
  }

  static getSystemTelemetry(): TelemetryData {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // CPU usage calculation
    let totalIdle = 0;
    let totalTick = 0;
    cpus.forEach((cpu) => {
      for (const type of Object.keys(cpu.times) as Array<keyof typeof cpu.times>) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuCurrent = Math.round(100 - (totalIdle / totalTick) * 100);

    this.cpuSamples.push(cpuCurrent);
    if (this.cpuSamples.length > 120) this.cpuSamples.shift();

    const cpuAverage = Math.round(this.cpuSamples.reduce((a, b) => a + b, 0) / this.cpuSamples.length);
    const cpuPeak = Math.max(...this.cpuSamples);

    const loadAvg = os.loadavg();

    return {
      cpu: {
        current: cpuCurrent,
        average: cpuAverage,
        peak: cpuPeak,
      },
      ram: {
        current: Math.round((usedMem / totalMem) * 100),
        used: usedMem,
        total: totalMem,
      },
      disk: {
        used: 0,
        available: 0,
        total: 0,
      },
      network: {
        rx: 0,
        tx: 0,
      },
      uptime: os.uptime(),
      load: loadAvg,
      containers: { total: 0, running: 0, stopped: 0 },
    };
  }

  static async getDashboardStats(userId: string, isAdmin: boolean): Promise<any> {
    let serverQuery = '';
    let params: any[] = [];

    if (isAdmin) {
      serverQuery = 'SELECT status, cpu_limit, ram_limit, disk_limit FROM servers';
    } else {
      serverQuery = 'SELECT status, cpu_limit, ram_limit, disk_limit FROM servers WHERE owner_id = $1';
      params = [userId];
    }

    const { rows: servers } = await query(serverQuery, params);

    const totalServers = servers.length;
    const onlineServers = servers.filter((s: any) => s.status === 'running').length;
    const offlineServers = servers.filter((s: any) => s.status === 'stopped').length;
    const suspendedServers = servers.filter((s: any) => s.status === 'suspended').length;

    const totalCpu = servers.reduce((sum: number, s: any) => sum + (Number(s.cpu_limit) || 0), 0);
    const totalRam = servers.reduce((sum: number, s: any) => sum + (Number(s.ram_limit) || 0), 0);
    const totalDisk = servers.reduce((sum: number, s: any) => sum + (Number(s.disk_limit) || 0), 0);

    const nodeQuery = isAdmin ? 'SELECT status FROM nodes' : `SELECT n.status FROM nodes n JOIN servers s ON s.node_id = n.id WHERE s.owner_id = $1`;
    const { rows: nodes } = await query(isAdmin ? nodeQuery : nodeQuery, isAdmin ? [] : [userId]);
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter((n: any) => n.status === 'online').length;

    let dockerStats = { total: 0, running: 0, stopped: 0 };
    try {
      dockerStats = await DockerService.getSystemDockerStats();
    } catch {}

    const systemTelemetry = this.getSystemTelemetry();

    return {
      servers: {
        total: totalServers,
        online: onlineServers,
        offline: offlineServers,
        suspended: suspendedServers,
      },
      resources: {
        totalCpu,
        totalRam,
        totalDisk,
      },
      nodes: {
        total: totalNodes,
        online: onlineNodes,
      },
      docker: dockerStats,
      system: systemTelemetry,
    };
  }

  static async getRecentActivity(limit = 20): Promise<any[]> {
    const { rows } = await query(
      `SELECT al.*, u.username
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  static async getNodeTelemetry(nodeId: string): Promise<any> {
    const { rows } = await query(`SELECT * FROM nodes WHERE id = $1`, [nodeId]);
    if (rows.length === 0) return null;

    const node = rows[0];

    const { rows: servers } = await query(
      `SELECT status, cpu_limit, ram_limit FROM servers WHERE node_id = $1`,
      [nodeId]
    );

    return {
      node: {
        ...node,
        metadata: typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata,
      },
      servers: {
        total: servers.length,
        running: servers.filter((s: any) => s.status === 'running').length,
      },
    };
  }
}
