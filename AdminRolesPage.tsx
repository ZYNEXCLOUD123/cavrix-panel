import React, { useState, useEffect } from 'react';
import { Shield, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Role } from '@/types';

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadRoles(); }, []);

  async function loadRoles() {
    try {
      const res = await api.admin.roles.list();
      if (res.success && res.data) setRoles(res.data as Role[]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-100">Roles</h2>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => (
            <div key={role.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield size={18} className="text-cavrix-400" />
                  <div>
                    <p className="text-sm font-semibold text-gray-200">{role.name}</p>
                    <p className="text-xs text-gray-500">{role.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Priority: {role.priority}</span>
                  {role.is_default && <span className="badge-muted text-[10px]">Default</span>}
                </div>
              </div>
              {role.permissions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((perm) => (
                      <span key={perm.key} className="px-2 py-0.5 rounded text-[10px] bg-surface-2 text-gray-400 border border-border">
                        {perm.key}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
