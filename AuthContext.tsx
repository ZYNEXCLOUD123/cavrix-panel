import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('cavrix_token');
      if (!token) {
        setUser(null);
        return;
      }
      const res = await api.auth.me();
      if (res.success && res.data) {
        setUser(res.data as User);
      } else {
        setUser(null);
        localStorage.removeItem('cavrix_token');
      }
    } catch {
      setUser(null);
      localStorage.removeItem('cavrix_token');
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    if (res.success && res.data) {
      localStorage.setItem('cavrix_token', (res.data as any).token);
      setUser((res.data as any).user);
    } else {
      throw new Error(res.error?.message || 'Login failed');
    }
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await api.auth.register(username, email, password);
    if (res.success && res.data) {
      localStorage.setItem('cavrix_token', (res.data as any).token);
      setUser((res.data as any).user);
    } else {
      throw new Error(res.error?.message || 'Registration failed');
    }
  };

  const logout = async () => {
    try { await api.auth.logout(); } catch {}
    localStorage.removeItem('cavrix_token');
    setUser(null);
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return user.permissions?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
