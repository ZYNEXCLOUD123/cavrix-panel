import { query } from './pool.js';

interface Migration {
  name: string;
  up: string;
}

const migrations: Migration[] = [
  {
    name: '001_create_users',
    up: `
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','suspended','banned')),
        is_admin BOOLEAN DEFAULT FALSE,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255) DEFAULT NULL,
        last_login_at TIMESTAMPTZ DEFAULT NULL,
        last_login_ip INET DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    `,
  },
  {
    name: '002_create_roles',
    up: `
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(64) UNIQUE NOT NULL,
        description TEXT DEFAULT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        key VARCHAR(128) UNIQUE NOT NULL,
        description TEXT DEFAULT NULL,
        category VARCHAR(64) DEFAULT 'general'
      );

      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, role_id)
      );
    `,
  },
  {
    name: '003_create_nodes',
    up: `
      CREATE TABLE IF NOT EXISTS nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(128) NOT NULL,
        hostname VARCHAR(255) NOT NULL,
        ip_address INET NOT NULL,
        port INTEGER DEFAULT 8080,
        location VARCHAR(128) DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online','offline','maintenance','error')),
        total_cpu INTEGER DEFAULT 0,
        total_ram BIGINT DEFAULT 0,
        total_disk BIGINT DEFAULT 0,
        used_cpu INTEGER DEFAULT 0,
        used_ram BIGINT DEFAULT 0,
        used_disk BIGINT DEFAULT 0,
        public_key TEXT DEFAULT NULL,
        daemon_token VARCHAR(255) DEFAULT NULL,
        last_heartbeat TIMESTAMPTZ DEFAULT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: '004_create_servers',
    up: `
      CREATE TABLE IF NOT EXISTS servers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(128) NOT NULL,
        description TEXT DEFAULT NULL,
        icon TEXT DEFAULT NULL,
        status VARCHAR(20) DEFAULT 'stopped' CHECK (status IN ('starting','running','stopping','stopped','suspended','crashed')),
        node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
        owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
        game_type VARCHAR(64) DEFAULT 'minecraft',
        server_type VARCHAR(64) DEFAULT 'paper',
        container_id VARCHAR(255) DEFAULT NULL,
        docker_image VARCHAR(255) DEFAULT NULL,
        runtime VARCHAR(20) DEFAULT 'docker' CHECK (runtime IN ('docker','local')),
        
        cpu_limit DECIMAL(10,2) DEFAULT 100,
        cpu_shares INTEGER DEFAULT 1024,
        ram_limit BIGINT DEFAULT 2048,
        swap_limit BIGINT DEFAULT 0,
        disk_limit BIGINT DEFAULT 10240,
        
        allocated_ip VARCHAR(45) DEFAULT NULL,
        allocated_port INTEGER DEFAULT 25565,
        additional_ports JSONB DEFAULT '[]',
        
        startup_command TEXT DEFAULT NULL,
        java_version INTEGER DEFAULT 21,
        jvm_args TEXT DEFAULT '-Xms{{SERVER_MEMORY}}M -Xmx{{SERVER_MEMORY}}M',
        server_variables JSONB DEFAULT '{}',
        environment JSONB DEFAULT '{}',
        
        installed BOOLEAN DEFAULT FALSE,
        installing BOOLEAN DEFAULT FALSE,
        
        path TEXT DEFAULT NULL,
        
        network_rx BIGINT DEFAULT 0,
        network_tx BIGINT DEFAULT 0,
        
        last_start_at TIMESTAMPTZ DEFAULT NULL,
        last_stop_at TIMESTAMPTZ DEFAULT NULL,
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_servers_owner ON servers(owner_id);
      CREATE INDEX IF NOT EXISTS idx_servers_node ON servers(node_id);
      CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
    `,
  },
  {
    name: '005_create_allocations',
    up: `
      CREATE TABLE IF NOT EXISTS allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
        ip_address INET NOT NULL,
        port INTEGER NOT NULL,
        server_id UUID DEFAULT NULL REFERENCES servers(id) ON DELETE SET NULL,
        description TEXT DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(node_id, ip_address, port)
      );
    `,
  },
  {
    name: '006_create_backups',
    up: `
      CREATE TABLE IF NOT EXISTS backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        size BIGINT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','building','completed','failed','restoring')),
        storage_type VARCHAR(20) DEFAULT 'local',
        file_path TEXT DEFAULT NULL,
        ignored_files TEXT DEFAULT NULL,
        is_successful BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ DEFAULT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_backups_server ON backups(server_id);
    `,
  },
  {
    name: '007_create_schedules',
    up: `
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        action VARCHAR(64) NOT NULL,
        command TEXT DEFAULT NULL,
        cron_expression VARCHAR(128) DEFAULT NULL,
        schedule_type VARCHAR(20) DEFAULT 'once' CHECK (schedule_type IN ('once','daily','weekly','cron')),
        is_active BOOLEAN DEFAULT TRUE,
        next_run_at TIMESTAMPTZ DEFAULT NULL,
        last_run_at TIMESTAMPTZ DEFAULT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: '008_create_sessions_and_audit',
    up: `
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        ip_address INET DEFAULT NULL,
        user_agent TEXT DEFAULT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(128) NOT NULL,
        target_type VARCHAR(64) DEFAULT NULL,
        target_id UUID DEFAULT NULL,
        details JSONB DEFAULT '{}',
        ip_address INET DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `,
  },
  {
    name: '009_create_api_keys',
    up: `
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        permissions JSONB DEFAULT '[]',
        last_used_at TIMESTAMPTZ DEFAULT NULL,
        expires_at TIMESTAMPTZ DEFAULT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
    `,
  },
  {
    name: '010_create_server_variables',
    up: `
      CREATE TABLE IF NOT EXISTS server_variables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
        key VARCHAR(128) NOT NULL,
        value TEXT DEFAULT NULL,
        is_secret BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(server_id, key)
      );
    `,
  },
  {
    name: '011_create_panel_settings',
    up: `
      CREATE TABLE IF NOT EXISTS panel_settings (
        key VARCHAR(128) PRIMARY KEY,
        value TEXT DEFAULT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
  {
    name: '012_create_migrations_table',
    up: `
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `,
  },
];

export async function runMigrations(): Promise<void> {
  console.log('[CAVRIX] Running database migrations...');

  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const { rows: applied } = await query<{ name: string }>('SELECT name FROM _migrations ORDER BY id');
  const appliedNames = new Set(applied.map((r) => r.name));

  for (const migration of migrations) {
    if (appliedNames.has(migration.name)) continue;
    console.log(`[CAVRIX] Applying migration: ${migration.name}`);
    await query(migration.up);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [migration.name]);
  }

  console.log('[CAVRIX] All migrations applied successfully.');
}

export async function rollbackLastMigration(): Promise<void> {
  const { rows } = await query<{ name: string; id: number }>('SELECT id, name FROM _migrations ORDER BY id DESC LIMIT 1');
  if (rows.length === 0) {
    console.log('[CAVRIX] No migrations to rollback.');
    return;
  }
  console.log(`[CAVRIX] Rolling back migration: ${rows[0].name}`);
  await query('DELETE FROM _migrations WHERE id = $1', [rows[0].id]);
  console.log('[CAVRIX] Rollback complete. Note: Tables/data not dropped.');
}

export { migrations };
