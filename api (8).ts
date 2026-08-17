import axios from 'axios';
import type { ApiResponse } from '@/types';

const API_PREFIX = '/api/v1';

const client = axios.create({
  baseURL: API_PREFIX,
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('cavrix_token');
  if (token && config.headers) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('cavrix_token');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

async function request<T = any>(method: string, url: string, data?: any, params?: any): Promise<ApiResponse<T>> {
  const response = await client.request<ApiResponse<T>>({ method, url, data, params });
  return response.data;
}

export const api = {
  get: <T = any>(url: string, params?: any) => request<T>('GET', url, undefined, params),
  post: <T = any>(url: string, data?: any) => request<T>('POST', url, data),
  put: <T = any>(url: string, data?: any) => request<T>('PUT', url, data),
  patch: <T = any>(url: string, data?: any) => request<T>('PATCH', url, data),
  delete: <T = any>(url: string, config?: { data?: any }) => {
    return client.request<ApiResponse<T>>({ method: 'DELETE', url, data: config?.data }).then(r => r.data);
  },

  auth: {
    login: (email: string, password: string) => api.post('/auth/login', { email, password }),
    register: (username: string, email: string, password: string) => api.post('/auth/register', { username, email, password }),
    me: () => api.get('/auth/me'),
    logout: () => api.post('/auth/logout'),
    changePassword: (currentPassword: string, newPassword: string) => api.post('/auth/change-password', { currentPassword, newPassword }),
  },

  servers: {
    list: () => api.get('/servers'),
    get: (id: string) => api.get(`/servers/${id}`),
    create: (data: any) => api.post('/servers', data),
    delete: (id: string) => api.delete(`/servers/${id}`),
    start: (id: string) => api.post(`/servers/${id}/start`),
    stop: (id: string) => api.post(`/servers/${id}/stop`),
    restart: (id: string) => api.post(`/servers/${id}/restart`),
    kill: (id: string) => api.post(`/servers/${id}/kill`),
    update: (id: string, data: any) => api.put(`/servers/${id}`, data),
    suspend: (id: string) => api.post(`/servers/${id}/suspend`),
    unsuspend: (id: string) => api.post(`/servers/${id}/unsuspend`),
  },

  files: {
    list: (serverId: string, path?: string) => api.get(`/files/${serverId}/list`, { path }),
    read: (serverId: string, path: string) => api.get(`/files/${serverId}/read`, { path }),
    write: (serverId: string, path: string, content: string) => api.post(`/files/${serverId}/write`, { path, content }),
    create: (serverId: string, path: string, type: string) => api.post(`/files/${serverId}/create`, { path, type }),
    delete: (serverId: string, path: string) => api.delete(`/files/${serverId}/delete`, { data: { path } }),
    rename: (serverId: string, oldPath: string, newPath: string) => api.put(`/files/${serverId}/rename`, { oldPath, newPath }),
    copy: (serverId: string, source: string, destination: string) => api.post(`/files/${serverId}/copy`, { source, destination }),
    search: (serverId: string, q: string) => api.get(`/files/${serverId}/search`, { q }),
  },

  backups: {
    list: (serverId: string) => api.get(`/backups/${serverId}`),
    create: (serverId: string) => api.post(`/backups/${serverId}`),
    restore: (serverId: string, backupId: string) => api.post(`/backups/${serverId}/${backupId}/restore`),
    delete: (serverId: string, backupId: string) => api.delete(`/backups/${serverId}/${backupId}`),
  },

  schedules: {
    list: (serverId: string) => api.get(`/schedules/${serverId}`),
    create: (serverId: string, data: any) => api.post(`/schedules/${serverId}`, data),
    toggle: (serverId: string, scheduleId: string, isActive: boolean) => api.put(`/schedules/${serverId}/${scheduleId}/toggle`, { is_active: isActive }),
    delete: (serverId: string, scheduleId: string) => api.delete(`/schedules/${serverId}/${scheduleId}`),
  },

  nodes: {
    list: () => api.get('/nodes'),
    get: (id: string) => api.get(`/nodes/${id}`),
    create: (data: any) => api.post('/nodes', data),
    update: (id: string, data: any) => api.put(`/nodes/${id}`, data),
    delete: (id: string) => api.delete(`/nodes/${id}`),
  },

  admin: {
    users: {
      list: () => api.get('/admin/users'),
      create: (data: any) => api.post('/admin/users', data),
      update: (id: string, data: any) => api.put(`/admin/users/${id}`, data),
      delete: (id: string) => api.delete(`/admin/users/${id}`),
      resetPassword: (id: string, password: string) => api.post(`/admin/users/${id}/reset-password`, { password }),
    },
    roles: {
      list: () => api.get('/admin/roles'),
      permissions: () => api.get('/admin/roles/permissions'),
      create: (data: any) => api.post('/admin/roles', data),
      update: (id: string, data: any) => api.put(`/admin/roles/${id}`, data),
      delete: (id: string) => api.delete(`/admin/roles/${id}`),
    },
    audit: {
      list: (params?: any) => api.get('/admin/audit', params),
    },
  },

  console: {
    logs: (serverId: string, tail?: number) => api.get(`/console/${serverId}/logs`, { tail }),
  },

  settings: {
    public: () => api.get('/settings/public'),
    get: () => api.get('/settings'),
    update: (data: any) => api.put('/settings', data),
  },

  health: {
    check: () => client.get('/api/health'),
    ready: () => client.get('/api/ready'),
    version: () => client.get('/api/version'),
  },
};

export default api;
