export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  avatar: string | null;
  status: 'active' | 'suspended' | 'banned';
  is_admin: boolean;
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  last_login_at: Date | null;
  last_login_ip: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  priority: number;
  created_at: Date;
}

export interface Permission {
  id: string;
  key: string;
  description: string | null;
  category: string;
}

export interface Server {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'suspended' | 'crashed';
  node_id: string | null;
  owner_id: string;
  game_type: string;
  server_type: string;
  container_id: string | null;
  docker_image: string | null;
  runtime: 'docker' | 'local';
  cpu_limit: number;
  cpu_shares: number;
  ram_limit: number;
  swap_limit: number;
  disk_limit: number;
  allocated_ip: string | null;
  allocated_port: number;
  additional_ports: string[];
  startup_command: string | null;
  java_version: number;
  jvm_args: string;
  server_variables: Record<string, string>;
  environment: Record<string, string>;
  installed: boolean;
  installing: boolean;
  path: string | null;
  network_rx: number;
  network_tx: number;
  last_start_at: Date | null;
  last_stop_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Node {
  id: string;
  name: string;
  hostname: string;
  ip_address: string;
  port: number;
  location: string | null;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  total_cpu: number;
  total_ram: number;
  total_disk: number;
  used_cpu: number;
  used_ram: number;
  used_disk: number;
  public_key: string | null;
  daemon_token: string | null;
  last_heartbeat: Date | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Allocation {
  id: string;
  node_id: string;
  ip_address: string;
  port: number;
  server_id: string | null;
  description: string | null;
  created_at: Date;
}

export interface Backup {
  id: string;
  server_id: string;
  name: string;
  size: number;
  status: 'pending' | 'building' | 'completed' | 'failed' | 'restoring';
  storage_type: string;
  file_path: string | null;
  ignored_files: string | null;
  is_successful: boolean;
  created_at: Date;
  completed_at: Date | null;
}

export interface Schedule {
  id: string;
  server_id: string;
  name: string;
  action: string;
  command: string | null;
  cron_expression: string | null;
  schedule_type: 'once' | 'daily' | 'weekly' | 'cron';
  is_active: boolean;
  next_run_at: Date | null;
  last_run_at: Date | null;
  created_by: string | null;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: Date;
}

export interface PanelSettings {
  panel_name: string;
  panel_tagline: string;
  primary_color: string;
  secondary_color: string;
  allow_registration: string;
  maintenance_mode: string;
  default_theme: string;
  max_upload_size: string;
  telemetry_interval: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  username: string;
  is_admin: boolean;
}

export interface AuthRequest extends Express.Request {
  user?: JwtPayload;
}

export interface TelemetryData {
  cpu: { current: number; average: number; peak: number };
  ram: { current: number; used: number; total: number };
  disk: { used: number; available: number; total: number };
  network: { rx: number; tx: number };
  uptime: number;
  load: number[];
  containers: { total: number; running: number; stopped: number };
}
