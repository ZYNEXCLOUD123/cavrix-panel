import React, { useState, useEffect } from 'react';
import { Shield, Users, Settings, Server, Network, Clock, Database } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import AdminUsersPage from './AdminUsersPage';
import AdminRolesPage from './AdminRolesPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminAuditPage from './AdminAuditPage';

const adminNav = [
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'roles', label: 'Roles', icon: Shield, path: '/admin/roles' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings' },
  { id: 'audit-logs', label: 'Audit Logs', icon: Clock, path: '/admin/audit-logs' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user?.is_admin) {
    return (
      <div className="card p-12 text-center">
        <Shield size={40} className="mx-auto text-gray-600 mb-3" />
        <p className="text-gray-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const currentTab = adminNav.find(n => location.pathname === n.path) || adminNav[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Administration</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your CAVRIX Panel</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-48 flex-shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {adminNav.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  location.pathname === item.path
                    ? 'bg-cavrix-600/15 text-cavrix-400'
                    : 'text-gray-400 hover:bg-surface-2 hover:text-gray-200'
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {location.pathname === '/admin/users' || location.pathname === '/admin' && <AdminUsersPage />}
          {location.pathname === '/admin/roles' && <AdminRolesPage />}
          {location.pathname === '/admin/settings' && <AdminSettingsPage />}
          {location.pathname === '/admin/audit-logs' && <AdminAuditPage />}
        </div>
      </div>
    </div>
  );
}
