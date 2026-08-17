import cron from 'node-cron';
import { query } from '../database/pool.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, AppError } from '../utils/errors.js';
import { BackupService } from './backupService.js';
import { DockerService } from './docker.js';

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export class ScheduleService {
  static async createSchedule(data: {
    server_id: string;
    name: string;
    action: string;
    command?: string;
    cron_expression?: string;
    schedule_type: string;
    created_by: string;
  }): Promise<any> {
    const { rows: servers } = await query(`SELECT id FROM servers WHERE id = $1`, [data.server_id]);
    if (servers.length === 0) throw new NotFoundError('Server');

    const id = uuidv4();
    let nextRunAt = null;

    if (data.schedule_type === 'cron' && data.cron_expression) {
      nextRunAt = getNextCronRun(data.cron_expression);
    } else if (data.schedule_type === 'daily') {
      nextRunAt = getNextDailyRun();
    } else if (data.schedule_type === 'weekly') {
      nextRunAt = getNextWeeklyRun();
    }

    await query(
      `INSERT INTO schedules (id, server_id, name, action, command, cron_expression, schedule_type, next_run_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, data.server_id, data.name, data.action, data.command || null, data.cron_expression || null, data.schedule_type, nextRunAt, data.created_by]
    );

    const { rows } = await query(`SELECT * FROM schedules WHERE id = $1`, [id]);
    return rows[0];
  }

  static async listSchedules(serverId: string): Promise<any[]> {
    const { rows } = await query(
      `SELECT * FROM schedules WHERE server_id = $1 ORDER BY created_at DESC`,
      [serverId]
    );
    return rows;
  }

  static async deleteSchedule(id: string): Promise<void> {
    this.stopScheduledTask(id);
    await query(`DELETE FROM schedules WHERE id = $1`, [id]);
  }

  static async toggleSchedule(id: string, isActive: boolean): Promise<void> {
    await query(`UPDATE schedules SET is_active = $1 WHERE id = $2`, [isActive, id]);
    if (!isActive) {
      this.stopScheduledTask(id);
    } else {
      const { rows } = await query(`SELECT * FROM schedules WHERE id = $1`, [id]);
      if (rows.length > 0) this.startScheduledTask(rows[0]);
    }
  }

  static startScheduledTask(schedule: any): void {
    if (!schedule.is_active || scheduledTasks.has(schedule.id)) return;

    let cronExpression = schedule.cron_expression;

    if (!cronExpression) {
      if (schedule.schedule_type === 'daily') {
        cronExpression = '0 0 * * *';
      } else if (schedule.schedule_type === 'weekly') {
        cronExpression = '0 0 * * 0';
      } else {
        return;
      }
    }

    if (!cron.validate(cronExpression)) {
      logger.warn(`[SCHEDULE] Invalid cron expression for schedule ${schedule.id}`);
      return;
    }

    const task = cron.schedule(cronExpression, async () => {
      logger.info(`[SCHEDULE] Executing: ${schedule.name} (${schedule.action})`);
      try {
        await this.executeSchedule(schedule);
        await query(`UPDATE schedules SET last_run_at = NOW() WHERE id = $1`, [schedule.id]);
      } catch (error: any) {
        logger.error(`[SCHEDULE] Failed: ${error.message}`);
      }
    });

    scheduledTasks.set(schedule.id, task);
  }

  static stopScheduledTask(id: string): void {
    const task = scheduledTasks.get(id);
    if (task) {
      task.stop();
      scheduledTasks.delete(id);
    }
  }

  static async executeSchedule(schedule: any): Promise<void> {
    switch (schedule.action) {
      case 'start': {
        const { rows } = await query(`SELECT * FROM servers WHERE id = $1`, [schedule.server_id]);
        if (rows.length > 0 && rows[0].runtime === 'docker') {
          await DockerService.startServer(rows[0]);
        }
        break;
      }
      case 'stop': {
        const { rows } = await query(`SELECT container_id FROM servers WHERE id = $1`, [schedule.server_id]);
        if (rows.length > 0 && rows[0].container_id) {
          await DockerService.stopContainer(rows[0].container_id);
          await query(`UPDATE servers SET status = 'stopped', last_stop_at = NOW() WHERE id = $1`, [schedule.server_id]);
        }
        break;
      }
      case 'restart': {
        const { rows } = await query(`SELECT container_id FROM servers WHERE id = $1`, [schedule.server_id]);
        if (rows.length > 0 && rows[0].container_id) {
          await DockerService.restartContainer(rows[0].container_id);
        }
        break;
      }
      case 'backup': {
        await BackupService.createBackup(schedule.server_id);
        break;
      }
      default:
        logger.warn(`[SCHEDULE] Unknown action: ${schedule.action}`);
    }
  }

  static async loadAllSchedules(): Promise<void> {
    const { rows } = await query(`SELECT * FROM schedules WHERE is_active = true`);
    for (const schedule of rows) {
      this.startScheduledTask(schedule);
    }
    logger.info(`[SCHEDULE] Loaded ${rows.length} active schedules`);
  }
}

function getNextCronRun(expression: string): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function getNextDailyRun(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function getNextWeeklyRun(): Date {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
  nextWeek.setHours(0, 0, 0, 0);
  return nextWeek;
}
