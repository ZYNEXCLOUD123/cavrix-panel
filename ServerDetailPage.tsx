import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play, Square, RotateCw, Skull, ArrowLeft, Terminal, FolderOpen,
  Database, Clock, Settings, Users, Activity
} from 'lucide-react';
import { api } from '@/lib/api';
import { getStatusColor, cn, formatBytesToMB, timeAgo } from '@/lib/utils';
import ConsoleTab from '@/components/ConsoleTab';
import FileManagerTab from '@/components/FileManagerTab';
import BackupsTab from '@/components/BackupsTab';
import SettingsTab from '@/components/SettingsTab';
import type { Server } from '@/types';

const tabs = [
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'files', label: 'Files', icon: FolderOpen },
  { id: 'backups', label: 'Backups', icon: Database },
  { id: 'schedules', label: 'Schedules', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function ServerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [server, setServer] = useState<Server | null>(null);
  const [activeTab, setActiveTab] = useState('console');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => { if (id) loadServer(); }, [id]);

  async function loadServer() {
    try {
      const res = await api.servers.get(id!);
      if (res.success && res.data) setServer(res.data as Server);
      else navigate('/servers');
    } catch {
      navigate('/servers');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(action: string) {
    if (!id) return;
    setActionLoading(action);
    try {
      if (action === 'start') await api.servers.start(id);
      else if (action === 'stop') await api.servers.stop(id);
      else if (action === 'restart') await api.servers.restart(id);
      else if (action === 'kill') await api.servers.kill(id);
      await new Promise(r => setTimeout(r, 1500));
      loadServer();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!server) return null;

  const isRunning = server.status === 'running';
  const isStopped = server.status === 'stopped';
  const isStarting = server.status === 'starting' || server.status === 'stopping';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <Link to="/servers" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-3">
          <ArrowLeft size={14} /> Servers
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn('status-dot mt-1', `status-${getStatusColor(server.status)}`)} />
            <div>
              <h1 className="text-xl font-bold text-gray-100">{server.name}</h1>
              <p className="text-sm text-gray-500">{server.server_type} &middot; Java {server.java_version} &middot; {server.allocated_port}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isStopped && (
              <button onClick={() => handleAction('start')} disabled={!!actionLoading} className="btn bg-green-600/10 hover:bg-green-600/20 text-green-400 border border-green-500/20">
                <Play size={14} /> Start
              </button>
            )}
            {isRunning && (
              <>
                <button onClick={() => handleAction('stop')} disabled={!!actionLoading} className="btn bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 border border-yellow-500/20">
                  <Square size={14} /> Stop
                </button>
                <button onClick={() => handleAction('restart')} disabled={!!actionLoading} className="btn bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20">
                  <RotateCw size={14} /> Restart
                </button>
                <button onClick={() => handleAction('kill')} disabled={!!actionLoading} className="btn-danger">
                  <Skull size={14} /> Kill
                </button>
              </>
            )}
            {isStarting && (
              <div className="flex items-center gap-2 text-yellow-400 text-sm">
                <div className="w-4 h-4 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin" />
                {server.status === 'starting' ? 'Starting...' : 'Stopping...'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resource Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">CPU</p>
          <p className="text-lg font-bold text-gray-100">{server.cpu_limit}%</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">RAM</p>
          <p className="text-lg font-bold text-gray-100">{formatBytesToMB(server.ram_limit * 1024 * 1024)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Disk</p>
          <p className="text-lg font-bold text-gray-100">{formatBytesToMB(server.disk_limit * 1024 * 1024)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Port</p>
          <p className="text-lg font-bold text-gray-100">{server.allocated_port}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all whitespace-nowrap',
                activeTab === tab.id ? 'tab-active' : 'tab-inactive'
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'console' && <ConsoleTab server={server} />}
        {activeTab === 'files' && <FileManagerTab server={server} />}
        {activeTab === 'backups' && <BackupsTab server={server} />}
        {activeTab === 'settings' && <SettingsTab server={server} onUpdated={loadServer} />}
      </div>
    </div>
  );
}
