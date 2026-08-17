import React, { useState, useEffect } from 'react';
import { Database, Download, RotateCw, Trash2, Plus, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDateTime, getStatusColor, cn } from '@/lib/utils';
import type { Server, Backup } from '@/types';

export default function BackupsTab({ server }: { server: Server }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadBackups(); }, [server.id]);

  async function loadBackups() {
    try {
      const res = await api.backups.list(server.id);
      if (res.success && res.data) setBackups(res.data as Backup[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    try {
      await api.backups.create(server.id);
      loadBackups();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Backup failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(backupId: string) {
    if (!confirm('Restore this backup? Server must be stopped.')) return;
    try {
      await api.backups.restore(server.id, backupId);
      alert('Backup restored successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Restore failed');
    }
  }

  async function handleDelete(backupId: string) {
    if (!confirm('Delete this backup permanently?')) return;
    try {
      await api.backups.delete(server.id, backupId);
      loadBackups();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Delete failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{backups.length} backup{backups.length !== 1 ? 's' : ''}</p>
        <button onClick={handleCreate} disabled={creating} className="btn-primary text-xs">
          {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus size={14} />}
          Create Backup
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center">
          <Database size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">No backups available</p>
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup) => (
            <div key={backup.id} className="card p-4 flex items-center gap-4">
              <Database size={18} className="text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-200">{backup.name}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span>{formatBytes(backup.size)}</span>
                  <span>{formatDateTime(backup.created_at)}</span>
                </div>
              </div>
              <span className={cn('badge', `badge-${getStatusColor(backup.status)}`)}>{backup.status}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => handleRestore(backup.id)}
                  className="p-2 text-gray-400 hover:text-green-400 rounded-lg hover:bg-surface-2" title="Restore">
                  <RotateCw size={14} />
                </button>
                <button onClick={() => handleDelete(backup.id)}
                  className="p-2 text-gray-400 hover:text-red-400 rounded-lg hover:bg-surface-2" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
