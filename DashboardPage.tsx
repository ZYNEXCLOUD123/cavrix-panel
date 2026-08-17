import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Server, ServerCrash, ServerOff, Activity, Cpu, MemoryStick,
  HardDrive, Network, ArrowRight, Clock, Shield
} from 'lucide-react';
import { api } from '@/lib/api';
import { useTelemetry } from '@/hooks/useTelemetry';
import { useAuth } from '@/context/AuthContext';
import { formatBytes, timeAgo, getStatusColor, cn } from '@/lib/utils';
import type { DashboardStats, Server as ServerType } from '@/types';

function StatCard({ icon: Icon, label, value, sub, color = 'cavrix' }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    cavrix: 'bg-cavrix-600/10 text-cavrix-400 border-cavrix-500/20',
    green: 'bg-green-600/10 text-green-400 border-green-500/20',
    red: 'bg-red-600/10 text-red-400 border-red-500/20',
    yellow: 'bg-yellow-600/10 text-yellow-400 border-yellow-500/20',
    blue: 'bg-blue-600/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
        </div>
        <div className={cn('p-2.5 rounded-xl border', colorMap[color] || colorMap.cavrix)}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function ResourceBar({ label, value, max, unit = 'MB' }: {
  label: string; value: number; max: number; unit?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-cavrix-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">
          {unit === 'MB' ? `${Math.round(value)} MB` : `${Math.round(pct)}%`}
          {max > 0 && ` / ${unit === 'MB' ? `${max} MB` : `${max}%`}`}
        </span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', barColor)}
          style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const telemetry = useTelemetry();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [servers, setServers] = useState<ServerType[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [serversRes] = await Promise.all([
        api.servers.list(),
      ]);

      if (serversRes.success && serversRes.data) {
        const serverList = serversRes.data as ServerType[];
        setServers(serverList);

        const totalServers = serverList.length;
        const online = serverList.filter((s) => s.status === 'running').length;
        const offline = serverList.filter((s) => s.status === 'stopped').length;
        const suspended = serverList.filter((s) => s.status === 'suspended').length;
        const totalCpu = serverList.reduce((sum, s) => sum + (Number(s.cpu_limit) || 0), 0);
        const totalRam = serverList.reduce((sum, s) => sum + (Number(s.ram_limit) || 0), 0);
        const totalDisk = serverList.reduce((sum, s) => sum + (Number(s.disk_limit) || 0), 0);

        setStats({
          servers: { total: totalServers, online, offline, suspended },
          resources: { totalCpu, totalRam, totalDisk },
          nodes: { total: 0, online: 0 },
          docker: { total: 0, running: 0, stopped: 0 },
          system: telemetry,
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.username}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Server} label="Total Servers" value={stats?.servers.total || 0} color="cavrix" />
        <StatCard icon={Activity} label="Online" value={stats?.servers.online || 0} color="green" />
        <StatCard icon={ServerOff} label="Offline" value={stats?.servers.offline || 0} color="red" />
        <StatCard icon={ServerCrash} label="Suspended" value={stats?.servers.suspended || 0} color="yellow" />
      </div>

      {/* Resource Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-200 mb-4">System Resources</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Cpu size={16} className="text-cavrix-400 flex-shrink-0" />
              <div className="flex-1">
                <ResourceBar label="CPU" value={telemetry.cpu.current} max={100} unit="%" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MemoryStick size={16} className="text-cavrix-400 flex-shrink-0" />
              <div className="flex-1">
                <ResourceBar label="RAM" value={Math.round(telemetry.ram.used / (1024 * 1024))} max={Math.round(telemetry.ram.total / (1024 * 1024))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <HardDrive size={16} className="text-cavrix-400 flex-shrink-0" />
              <div className="flex-1">
                <ResourceBar label="Disk" value={telemetry.disk.used} max={telemetry.disk.total || 1} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Network size={16} className="text-cavrix-400 flex-shrink-0" />
              <div className="flex-1">
                <ResourceBar label="Network RX" value={Math.round(telemetry.network.rx / (1024 * 1024))} max={100} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">CPU Peak</span>
              <p className="text-gray-200 font-medium">{telemetry.cpu.peak}%</p>
            </div>
            <div>
              <span className="text-gray-500">CPU Average</span>
              <p className="text-gray-200 font-medium">{telemetry.cpu.average}%</p>
            </div>
            <div>
              <span className="text-gray-500">Load Average</span>
              <p className="text-gray-200 font-medium">{telemetry.load.map(l => l.toFixed(2)).join(', ')}</p>
            </div>
            <div>
              <span className="text-gray-500">Uptime</span>
              <p className="text-gray-200 font-medium">{Math.floor(telemetry.uptime / 3600)}h {Math.floor((telemetry.uptime % 3600) / 60)}m</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-200">Servers</h3>
            <Link to="/servers" className="text-xs text-cavrix-400 hover:text-cavrix-300 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12">
              <Server size={32} className="mx-auto text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">No servers yet</p>
              <Link to="/servers" className="btn-primary mt-3 text-xs">Create Server</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {servers.slice(0, 6).map((server) => (
                <Link
                  key={server.id}
                  to={`/servers/${server.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-2 transition-colors group"
                >
                  <div className={cn('status-dot', `status-${getStatusColor(server.status)}`)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate group-hover:text-cavrix-400 transition-colors">
                      {server.name}
                    </p>
                    <p className="text-xs text-gray-500">{server.server_type} &middot; Java {server.java_version}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{server.allocated_port}</p>
                    <p className="text-[10px] text-gray-600">{timeAgo(server.last_start_at || server.created_at)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
