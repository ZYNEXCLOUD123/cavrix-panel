export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string | null;
  status: 'active' | 'suspended' | 'banned';
  is_admin: boolean;
  two_factor_enabled: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: string[];
  permissions: string[];
}

export interface Server {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'suspended' | 'crashed';
  node_id: string | null;
  owner_id: string;
  owner_name?: string;
  game_type: string;
  server_type: string;
  container_id: string | null;
  runtime: 'docker' | 'local';
  cpu_limit: number;
  ram_limit: number;
  disk_limit: number;
  allocated_port: number;
  java_version: number;
  startup_command: string | null;
  jvm_args: string | null;
  environment: Record<string, string>;
  installed: boolean;
  path: string | null;
  last_start_at: string | null;
  last_stop_at: string | null;
  created_at: string;
  node?: Node;
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
  last_heartbeat: string | null;
  server_count?: number;
  servers_running?: number;
  created_at: string;
}

export interface Backup {
  id: string;
  server_id: string;
  name: string;
  size: number;
  status: 'pending' | 'building' | 'completed' | 'failed' | 'restoring';
  is_successful: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface Schedule {
  id: string;
  server_id: string;
  name: string;
  action: string;
  command: string | null;
  cron_expression: string | null;
  schedule_type: string;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  priority: number;
  permissions: Permission[];
  created_at: string;
}

export interface Permission {
  key: string;
  description: string | null;
  category: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  modified: string;
  permissions: string;
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

export interface DashboardStats {
  servers: { total: number; online: number; offline: number; suspended: number };
  resources: { totalCpu: number; totalRam: number; totalDisk: number };
  nodes: { total: number; online: number };
  docker: { total: number; running: number; stopped: number };
  system: TelemetryData;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { code: string; message: string; errors?: Record<string, string> };
}
