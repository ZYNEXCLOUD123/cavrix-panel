import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Server, Search, MoreVertical, Play, Square, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getStatusColor, cn, timeAgo } from '@/lib/utils';
import type { Server as ServerType } from '@/types';

export default function ServersPage() {
  const [servers, setServers] = useState<ServerType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadServers(); }, []);

  async function loadServers() {
    try {
      const res = await api.servers.list();
      if (res.success && res.data) setServers(res.data as ServerType[]);
    } catch (err) {
      console.error('Failed to load servers:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredServers = servers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.server_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Servers</h1>
          <p className="text-sm text-gray-500 mt-1">{servers.length} server{servers.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} /> Create Server
        </button>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" className="input pl-10" placeholder="Search servers..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : filteredServers.length === 0 ? (
        <div className="card p-12 text-center">
          <Server size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 mb-1">
            {search ? 'No servers match your search' : 'No servers yet'}
          </p>
          {!search && (
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-3 text-sm">
              <Plus size={14} /> Create Server
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredServers.map((server) => (
            <ServerCard key={server.id} server={server} onUpdate={loadServers} />
          ))}
        </div>
      )}

      {showCreate && <CreateServerModal onClose={() => setShowCreate(false)} onCreated={loadServers} />}
    </div>
  );
}

function ServerCard({ server, onUpdate }: { server: ServerType; onUpdate: () => void }) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function handleAction(action: string) {
    setActionLoading(action);
    try {
      if (action === 'start') await api.servers.start(server.id);
      else if (action === 'stop') await api.servers.stop(server.id);
      else if (action === 'restart') await api.servers.restart(server.id);
      else if (action === 'delete') {
        if (confirm('Delete this server permanently?')) {
          await api.servers.delete(server.id);
          onUpdate();
        }
      }
      await new Promise(r => setTimeout(r, 500));
      onUpdate();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setActionLoading(null);
      setActionsOpen(false);
    }
  }

  return (
    <div className="card-hover p-5 relative group">
      <div className="flex items-start justify-between mb-3">
        <Link to={`/servers/${server.id}`} className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn('status-dot mt-1', `status-${getStatusColor(server.status)}`)} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-100 truncate group-hover:text-cavrix-400 transition-colors">
              {server.name}
            </h3>
            <p className="text-xs text-gray-500">{server.server_type} &middot; Java {server.java_version}</p>
          </div>
        </Link>

        <div className="relative">
          <button onClick={() => setActionsOpen(!actionsOpen)}
            className="p-1.5 rounded-lg hover:bg-surface-2 text-gray-500 hover:text-gray-300">
            <MoreVertical size={16} />
          </button>
          {actionsOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setActionsOpen(false)} />
              <div className="absolute right-0 top-8 w-40 card p-1 z-20 shadow-xl">
                {server.status === 'stopped' && (
                  <button onClick={() => handleAction('start')}
                    disabled={!!actionLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-surface-2 rounded-lg">
                    <Play size={14} /> Start
                  </button>
                )}
                {server.status === 'running' && (
                  <>
                    <button onClick={() => handleAction('stop')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-surface-2 rounded-lg">
                      <Square size={14} /> Stop
                    </button>
                    <button onClick={() => handleAction('restart')}
                      disabled={!!actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-surface-2 rounded-lg">
                      <Play size={14} /> Restart
                    </button>
                  </>
                )}
                <button onClick={() => handleAction('delete')}
                  disabled={!!actionLoading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-2 rounded-lg">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="text-center p-2 bg-surface-2 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">CPU</p>
          <p className="text-sm font-medium text-gray-200">{server.cpu_limit}%</p>
        </div>
        <div className="text-center p-2 bg-surface-2 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">RAM</p>
          <p className="text-sm font-medium text-gray-200">{server.ram_limit} MB</p>
        </div>
        <div className="text-center p-2 bg-surface-2 rounded-lg">
          <p className="text-[10px] text-gray-500 uppercase">Port</p>
          <p className="text-sm font-medium text-gray-200">{server.allocated_port}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-gray-500">
        <span className={cn('badge', `badge-${getStatusColor(server.status)}`)}>{server.status}</span>
        <span>{timeAgo(server.created_at)}</span>
      </div>
    </div>
  );
}

function CreateServerModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '',
    server_type: 'paper',
    java_version: 21,
    ram_limit: 2048,
    cpu_limit: 100,
    disk_limit: 10240,
    allocated_port: 25565,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.servers.create(form);
      if (res.success) {
        onCreated();
        onClose();
      } else {
        setError(res.error?.message || 'Failed to create server');
      }
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative card w-full max-w-lg p-6 mx-4">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Create Server</h2>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Server Name</label>
            <input className="input" placeholder="My Server" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Server Type</label>
              <select className="input" value={form.server_type}
                onChange={(e) => setForm({ ...form, server_type: e.target.value })}>
                <option value="paper">Paper</option>
                <option value="purpur">Purpur</option>
                <option value="spigot">Spigot</option>
                <option value="vanilla">Vanilla</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
              </select>
            </div>
            <div>
              <label className="label">Java Version</label>
              <select className="input" value={form.java_version}
                onChange={(e) => setForm({ ...form, java_version: Number(e.target.value) })}>
                <option value={8}>Java 8</option>
                <option value={11}>Java 11</option>
                <option value={17}>Java 17</option>
                <option value={21}>Java 21</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">RAM (MB)</label>
              <input type="number" className="input" value={form.ram_limit} min={128}
                onChange={(e) => setForm({ ...form, ram_limit: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">CPU (%)</label>
              <input type="number" className="input" value={form.cpu_limit} min={1}
                onChange={(e) => setForm({ ...form, cpu_limit: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Port</label>
              <input type="number" className="input" value={form.allocated_port} min={1} max={65535}
                onChange={(e) => setForm({ ...form, allocated_port: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Server'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
