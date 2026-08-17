import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Key } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDateTime, getStatusColor, cn } from '@/lib/utils';
import type { User } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    try {
      const res = await api.admin.users.list();
      if (res.success && res.data) setUsers(res.data as User[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.admin.users.delete(id);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  }

  async function handleResetPassword(id: string) {
    const pw = prompt('Enter new password (min 8 chars):');
    if (!pw || pw.length < 8) return;
    try {
      await api.admin.users.resetPassword(id, pw);
      alert('Password reset successfully.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-100">Users</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3 font-medium">User</th>
                  <th className="text-left px-4 py-3 font-medium">Roles</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Joined</th>
                  <th className="text-right px-4 py-3 font-medium w-32">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="table-row">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-200">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(user.roles || []).map((role) => (
                          <span key={role} className="badge-info text-[10px]">{role}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('badge', `badge-${getStatusColor(user.status)}`)}>{user.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(user.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleResetPassword(user.id)}
                          className="p-1.5 text-gray-400 hover:text-yellow-400 rounded-lg hover:bg-surface-2" title="Reset Password">
                          <Key size={14} />
                        </button>
                        <button onClick={() => handleDelete(user.id)}
                          className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg hover:bg-surface-2" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
