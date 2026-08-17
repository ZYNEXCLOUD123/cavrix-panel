import { query, transaction } from './pool.js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: '../.env' });

const PERMISSIONS = [
  { key: 'server.create', description: 'Create servers', category: 'server' },
  { key: 'server.delete', description: 'Delete servers', category: 'server' },
  { key: 'server.start', description: 'Start servers', category: 'server' },
  { key: 'server.stop', description: 'Stop servers', category: 'server' },
  { key: 'server.restart', description: 'Restart servers', category: 'server' },
  { key: 'server.console', description: 'Access server console', category: 'server' },
  { key: 'server.files.read', description: 'Read server files', category: 'files' },
  { key: 'server.files.write', description: 'Write server files', category: 'files' },
  { key: 'server.backup.create', description: 'Create backups', category: 'backup' },
  { key: 'server.backup.restore', description: 'Restore backups', category: 'backup' },
  { key: 'server.settings', description: 'Manage server settings', category: 'server' },
  { key: 'server.users', description: 'Manage server users', category: 'server' },
  { key: 'node.view', description: 'View nodes', category: 'node' },
  { key: 'node.manage', description: 'Manage nodes', category: 'node' },
  { key: 'user.manage', description: 'Manage users', category: 'admin' },
  { key: 'settings.manage', description: 'Manage panel settings', category: 'admin' },
  { key: 'role.manage', description: 'Manage roles', category: 'admin' },
  { key: 'audit.view', description: 'View audit logs', category: 'admin' },
];

const ROLES = [
  { name: 'OWNER', description: 'Full panel owner access', priority: 100, is_default: false },
  { name: 'ADMIN', description: 'Administrator access', priority: 90, is_default: false },
  { name: 'STAFF', description: 'Staff member access', priority: 70, is_default: false },
  { name: 'MODERATOR', description: 'Moderator access', priority: 50, is_default: false },
  { name: 'USER', description: 'Regular user access', priority: 10, is_default: true },
];

export async function seed(): Promise<void> {
  console.log('[CAVRIX] Seeding database...');

  await transaction(async (client) => {
    for (const perm of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (id, key, description, category) VALUES ($1, $2, $3, $4) ON CONFLICT (key) DO NOTHING`,
        [uuidv4(), perm.key, perm.description, perm.category]
      );
    }

    const { rows: permRows } = await client.query<{ id: string; key: string }>('SELECT id, key FROM permissions');
    const permMap = new Map(permRows.map((p) => [p.key, p.id]));

    for (const role of ROLES) {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO roles (id, name, description, priority, is_default) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (name) DO UPDATE SET description = $3 RETURNING id`,
        [uuidv4(), role.name, role.description, role.priority, role.is_default]
      );

      const roleId = rows[0].id;

      if (role.name === 'OWNER' || role.name === 'ADMIN') {
        for (const permKey of permMap.values()) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [roleId, permKey]
          );
        }
      }

      if (role.name === 'USER') {
        const userPerms = ['server.console', 'server.files.read', 'server.files.write'];
        for (const pk of userPerms) {
          const pid = permMap.get(pk);
          if (pid) {
            await client.query(
              `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [roleId, pid]
            );
          }
        }
      }
    }

    const defaultSettings: Record<string, string> = {
      panel_name: 'CAVRIX',
      panel_tagline: 'Powering Your Game Infrastructure',
      primary_color: '#6366f1',
      secondary_color: '#8b5cf6',
      allow_registration: 'true',
      maintenance_mode: 'false',
      default_theme: 'dark',
      max_upload_size: '104857600',
      telemetry_interval: '5000',
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await client.query(
        `INSERT INTO panel_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [key, value]
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminId = uuidv4();

    const { rows: existingAdmin } = await client.query(
      `SELECT id FROM users WHERE email = 'admin@cavrix.panel' LIMIT 1`
    );

    if (existingAdmin.length === 0) {
      await client.query(
        `INSERT INTO users (id, username, email, password_hash, is_admin, status) VALUES ($1, $2, $3, $4, true, 'active')`,
        [adminId, 'admin', 'admin@cavrix.panel', passwordHash]
      );

      const { rows: ownerRole } = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE name = 'OWNER' LIMIT 1`
      );
      if (ownerRole.length > 0) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [adminId, ownerRole[0].id]
        );
      }

      console.log('[CAVRIX] Default admin created: admin@cavrix.panel');
    }
  });

  console.log('[CAVRIX] Database seeded successfully.');
}

if (process.argv[1]?.includes('seed')) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[CAVRIX] Seed failed:', err);
      process.exit(1);
    });
}
