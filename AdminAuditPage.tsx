import React, { useState, useEffect } from 'react';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import type { AuditLog } from '@/types';

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  useEffect(() => { loadLogs(); }, [page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await api.admin.audit.list({ page, limit });
      if (res.success && res.data) {
        setLogs((res.data as any).logs);
        setTotal((res.data as any).total);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-100">Audit Logs</h2>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center">
          <Clock size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">No audit logs yet</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-gray-500 uppercase">
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Action</th>
                    <th className="text-left px-4 py-3 font-medium">Target</th>
                    <th className="text-left px-4 py-3 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-gray-200">{log.username || 'System'}</td>
                      <td className="px-4 py-3">
                        <span className="badge-info text-xs">{log.action}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {log.target_type ? `${log.target_type}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}-{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary text-xs">
                <ChevronLeft size={14} /> Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary text-xs">
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
