import { query } from '../database/pool.js';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class NodeService {
  static async createNode(data: { name: string; hostname: string; ip_address: string; port?: number; location?: string }): Promise<any> {
    const existing = await query(`SELECT id FROM nodes WHERE hostname = $1 OR (ip_address = $2 AND port = $3)`, [
      data.hostname,
      data.ip_address,
      data.port || 8080,
    ]);
    if (existing.rows.length > 0) throw new ConflictError('Node with this hostname or address already exists.');

    const id = uuidv4();
    const daemonToken = `node_${crypto.randomBytes(32).toString('hex')}`;

    await query(
      `INSERT INTO nodes (id, name, hostname, ip_address, port, location, daemon_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'offline')`,
      [id, data.name, data.hostname, data.ip_address, data.port || 8080, data.location || null, daemonToken]
    );

    const { rows } = await query(`SELECT * FROM nodes WHERE id = $1`, [id]);
    return { ...rows[0], daemon_token: daemonToken };
  }

  static async listNodes(): Promise<any[]> {
    const { rows: nodes } = await query(`SELECT * FROM nodes ORDER BY created_at DESC`);

    const nodesWithStats = await Promise.all(
      nodes.map(async (node: any) => {
        const { rows: servers } = await query(
          `SELECT status FROM servers WHERE node_id = $1`,
          [node.id]
        );
        return {
          ...node,
          metadata: typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata,
          server_count: servers.length,
          servers_running: servers.filter((s: any) => s.status === 'running').length,
        };
      })
    );

    return nodesWithStats;
  }

  static async getNode(id: string): Promise<any> {
    const { rows } = await query(`SELECT * FROM nodes WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('Node');

    const node = rows[0];

    const { rows: servers } = await query(
      `SELECT id, name, status, cpu_limit, ram_limit FROM servers WHERE node_id = $1`,
      [id]
    );

    return {
      ...node,
      metadata: typeof node.metadata === 'string' ? JSON.parse(node.metadata) : node.metadata,
      servers,
    };
  }

  static async updateNode(id: string, data: Partial<{ name: string; hostname: string; ip_address: string; port: number; location: string; status: string }>): Promise<void> {
    const { rows } = await query(`SELECT id FROM nodes WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('Node');

    await query(
      `UPDATE nodes SET
        name = COALESCE($1, name),
        hostname = COALESCE($2, hostname),
        ip_address = COALESCE($3, ip_address),
        port = COALESCE($4, port),
        location = COALESCE($5, location),
        status = COALESCE($6, status),
        updated_at = NOW()
       WHERE id = $7`,
      [data.name, data.hostname, data.ip_address, data.port, data.location, data.status, id]
    );
  }

  static async deleteNode(id: string): Promise<void> {
    const { rows } = await query(`SELECT id FROM nodes WHERE id = $1`, [id]);
    if (rows.length === 0) throw new NotFoundError('Node');

    // Check for assigned servers
    const { rows: servers } = await query(`SELECT id FROM servers WHERE node_id = $1 LIMIT 1`, [id]);
    if (servers.length > 0) {
      throw new ConflictError('Cannot delete node with assigned servers.');
    }

    await query(`DELETE FROM nodes WHERE id = $1`, [id]);
    logger.info(`[NODE] Deleted node ${id}`);
  }

  static async heartbeat(nodeId: string, data: any): Promise<void> {
    await query(
      `UPDATE nodes SET
        status = 'online',
        used_cpu = $1,
        used_ram = $2,
        used_disk = $3,
        total_cpu = COALESCE($4, total_cpu),
        total_ram = COALESCE($5, total_ram),
        total_disk = COALESCE($6, total_disk),
        metadata = $7,
        last_heartbeat = NOW(),
        updated_at = NOW()
       WHERE id = $8`,
      [
        data.cpu || 0,
        data.ram || 0,
        data.disk || 0,
        data.totalCpu || null,
        data.totalRam || null,
        data.totalDisk || null,
        JSON.stringify(data.metadata || {}),
        nodeId,
      ]
    );
  }
}
