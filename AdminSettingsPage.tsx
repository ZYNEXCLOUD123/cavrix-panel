import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { api } from '@/lib/api';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  async function loadSettings() {
    try {
      const res = await api.settings.get();
      if (res.success && res.data) setSettings(res.data as Record<string, string>);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.settings.update(settings);
      alert('Settings saved.');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const update = (key: string, value: string) => setSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-100">Panel Settings</h2>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Branding</h3>
            <div>
              <label className="label">Panel Name</label>
              <input className="input" value={settings.panel_name || ''} onChange={(e) => update('panel_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Tagline</label>
              <input className="input" value={settings.panel_tagline || ''} onChange={(e) => update('panel_tagline', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Primary Color</label>
                <input type="color" className="input h-10 p-1" value={settings.primary_color || '#6366f1'}
                  onChange={(e) => update('primary_color', e.target.value)} />
              </div>
              <div>
                <label className="label">Secondary Color</label>
                <input type="color" className="input h-10 p-1" value={settings.secondary_color || '#8b5cf6'}
                  onChange={(e) => update('secondary_color', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-200">Security</h3>
            <div>
              <label className="label">Allow Registration</label>
              <select className="input" value={settings.allow_registration || 'true'}
                onChange={(e) => update('allow_registration', e.target.value)}>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <div>
              <label className="label">Maintenance Mode</label>
              <select className="input" value={settings.maintenance_mode || 'false'}
                onChange={(e) => update('maintenance_mode', e.target.value)}>
                <option value="false">Disabled</option>
                <option value="true">Enabled</option>
              </select>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : <><Save size={14} /> Save Settings</>}
          </button>
        </>
      )}
    </div>
  );
}
