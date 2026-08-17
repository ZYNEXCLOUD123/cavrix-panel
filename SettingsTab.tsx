import React, { useState, useEffect } from 'react';
import { Save, RotateCw } from 'lucide-react';
import { api } from '@/lib/api';
import type { Server } from '@/types';

export default function SettingsTab({ server, onUpdated }: { server: Server; onUpdated: () => void }) {
  const [form, setForm] = useState({
    name: server.name,
    description: server.description || '',
    cpu_limit: server.cpu_limit,
    ram_limit: server.ram_limit,
    disk_limit: server.disk_limit,
    java_version: server.java_version,
    startup_command: server.startup_command || '',
    jvm_args: server.jvm_args || '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm({
      name: server.name,
      description: server.description || '',
      cpu_limit: server.cpu_limit,
      ram_limit: server.ram_limit,
      disk_limit: server.disk_limit,
      java_version: server.java_version,
      startup_command: server.startup_command || '',
      jvm_args: server.jvm_args || '',
    });
  }, [server]);

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await api.servers.update(server.id, form);
      if (res.success) {
        setMessage('Settings saved successfully.');
        onUpdated();
      }
    } catch (err: any) {
      setMessage(err.response?.data?.error?.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">General</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Server Name</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Resources</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">CPU (%)</label>
            <input type="number" className="input" value={form.cpu_limit} min={1}
              onChange={(e) => setForm({ ...form, cpu_limit: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">RAM (MB)</label>
            <input type="number" className="input" value={form.ram_limit} min={128}
              onChange={(e) => setForm({ ...form, ram_limit: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Disk (MB)</label>
            <input type="number" className="input" value={form.disk_limit} min={1024}
              onChange={(e) => setForm({ ...form, disk_limit: Number(e.target.value) })} />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-200 mb-4">Startup</h3>
        <div className="space-y-4">
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
          <div>
            <label className="label">Startup Command</label>
            <textarea className="input font-mono text-xs min-h-[80px]" value={form.startup_command}
              onChange={(e) => setForm({ ...form, startup_command: e.target.value })} />
          </div>
          <div>
            <label className="label">JVM Arguments</label>
            <input className="input font-mono text-xs" value={form.jvm_args}
              onChange={(e) => setForm({ ...form, jvm_args: e.target.value })} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
          Save Changes
        </button>
        {message && (
          <span className="text-sm text-gray-400">{message}</span>
        )}
      </div>
    </div>
  );
}
