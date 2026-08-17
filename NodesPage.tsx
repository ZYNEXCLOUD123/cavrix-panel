import React, { useState, useEffect } from 'react';
import { Network, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { getStatusColor, cn, timeAgo, formatBytesToMB } from '@/lib/utils';
import type { Node } from '@/types';

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadNodes(); }, []);

  async function loadNodes() {
    try {
      const res = await api.nodes.list();
      if (res.success && res.data) setNodes(res.data as Node[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Nodes</h1>
          <p className="text-sm text-gray-500 mt-1">{nodes.length} node{nodes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadNodes} className="btn-secondary text-sm"><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="card p-12 text-center">
          <Network size={40} className="mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No nodes connected</p>
          <p className="text-sm text-gray-500 mt-1">Install the CAVRIX daemon on your servers to add them as nodes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {nodes.map((node) => (
            <div key={node.id} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn('status-dot', `status-${getStatusColor(node.status)}`)} />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-100">{node.name}</h3>
                    <p className="text-xs text-gray-500">{node.hostname}</p>
                  </div>
                </div>
                <span className={cn('badge', `badge-${getStatusColor(node.status)}`)}>{node.status}</span>
              </div>

              <div className="space-y-3 mt-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">CPU</span>
                    <span className="text-gray-400">{node.used_cpu}% / {node.total_cpu}%</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-cavrix-500 rounded-full" style={{ width: `${node.total_cpu > 0 ? (node.used_cpu / node.total_cpu) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">RAM</span>
                    <span className="text-gray-400">{formatBytesToMB(node.used_ram)} / {formatBytesToMB(node.total_ram)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-cavrix-500 rounded-full" style={{ width: `${node.total_ram > 0 ? (node.used_ram / node.total_ram) * 100 : 0}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">Disk</span>
                    <span className="text-gray-400">{formatBytesToMB(node.used_disk)} / {formatBytesToMB(node.total_disk)}</span>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full bg-cavrix-500 rounded-full" style={{ width: `${node.total_disk > 0 ? (node.used_disk / node.total_disk) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-gray-500">
                <span>{node.server_count || 0} server{(node.server_count || 0) !== 1 ? 's' : ''}</span>
                <span>{node.location || 'Unknown location'}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
