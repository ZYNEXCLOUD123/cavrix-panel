import React, { useState, useEffect, useCallback } from 'react';
import {
  Folder, File, Upload, Download, Trash2, Plus, Search, ArrowLeft,
  FileText, RefreshCw, FolderPlus
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatDateTime } from '@/lib/utils';
import type { Server, FileEntry } from '@/types';

export default function FileManagerTab({ server }: { server: Server }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');
  const [saving, setSaving] = useState(false);

  const loadFiles = useCallback(async (path?: string) => {
    setLoading(true);
    try {
      const res = await api.files.list(server.id, path || currentPath);
      if (res.success && res.data) setFiles(res.data as FileEntry[]);
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, [server.id, currentPath]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    loadFiles(path);
  };

  const goBack = () => {
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length ? parts.join('/') : '.';
    navigateTo(newPath);
  };

  const handleFileClick = async (file: FileEntry) => {
    if (file.type === 'directory') {
      navigateTo(file.path);
    } else {
      try {
        const res = await api.files.read(server.id, file.path);
        if (res.success && res.data) {
          setEditingFile(file.path);
          setFileContent((res.data as any).content);
        }
      } catch (err: any) {
        alert(err.response?.data?.error?.message || 'Failed to read file');
      }
    }
  };

  const handleSave = async () => {
    if (!editingFile) return;
    setSaving(true);
    try {
      await api.files.write(server.id, editingFile, fileContent);
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (file: FileEntry) => {
    if (!confirm(`Delete ${file.name}?`)) return;
    try {
      await api.files.delete(server.id, file.path);
      loadFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to delete');
    }
  };

  const handleCreate = async (type: 'file' | 'directory') => {
    const name = prompt(`Enter ${type} name:`);
    if (!name) return;
    const path = currentPath === '.' ? name : `${currentPath}/${name}`;
    try {
      await api.files.create(server.id, path, type);
      loadFiles();
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to create');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('path', currentPath);
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    try {
      const token = localStorage.getItem('cavrix_token');
      await fetch(`/api/v1/files/${server.id}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      loadFiles();
    } catch (err: any) {
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const pathParts = currentPath === '.' ? [] : currentPath.split('/');

  const filteredFiles = files.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Editor view
  if (editingFile) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => setEditingFile(null)} className="btn-ghost text-xs">
              <ArrowLeft size={14} /> Back
            </button>
            <span className="text-sm text-gray-400 font-mono">{editingFile}</span>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
        <textarea
          className="w-full h-[500px] bg-surface-0 border border-border rounded-xl p-4 font-mono text-sm text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-cavrix-500/30"
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          spellCheck={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => handleCreate('file')} className="btn-secondary text-xs">
          <FileText size={14} /> New File
        </button>
        <button onClick={() => handleCreate('directory')} className="btn-secondary text-xs">
          <FolderPlus size={14} /> New Folder
        </button>
        <label className="btn-secondary text-xs cursor-pointer">
          <Upload size={14} /> Upload
          <input type="file" multiple className="hidden" onChange={handleUpload} />
        </label>
        <button onClick={() => loadFiles()} className="btn-secondary text-xs">
          <RefreshCw size={14} /> Refresh
        </button>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input type="text" className="input pl-9 text-xs py-1.5" placeholder="Search files..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm">
        <button onClick={() => navigateTo('.')} className="text-cavrix-400 hover:text-cavrix-300 font-medium">
          /
        </button>
        {pathParts.map((part, i) => (
          <React.Fragment key={i}>
            <span className="text-gray-600">/</span>
            <button
              onClick={() => navigateTo(pathParts.slice(0, i + 1).join('/'))}
              className="text-cavrix-400 hover:text-cavrix-300"
            >
              {part}
            </button>
          </React.Fragment>
        ))}
        {currentPath !== '.' && (
          <button onClick={goBack} className="ml-2 text-gray-400 hover:text-gray-200">
            <ArrowLeft size={14} />
          </button>
        )}
      </div>

      {/* File List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-cavrix-500/30 border-t-cavrix-500 rounded-full animate-spin" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="card p-8 text-center">
          <Folder size={32} className="mx-auto text-gray-600 mb-3" />
          <p className="text-sm text-gray-400">{search ? 'No matching files' : 'Empty directory'}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-xs text-gray-500 uppercase">
                  <th className="text-left px-4 py-3 font-medium">Name</th>
                  <th className="text-right px-4 py-3 font-medium">Size</th>
                  <th className="text-right px-4 py-3 font-medium">Modified</th>
                  <th className="text-right px-4 py-3 font-medium w-20"></th>
                </tr>
              </thead>
              <tbody>
                {currentPath !== '.' && (
                  <tr className="table-row">
                    <td colSpan={4} className="px-4 py-2.5">
                      <button onClick={goBack} className="text-sm text-gray-400 hover:text-cavrix-400 flex items-center gap-1">
                        <ArrowLeft size={14} /> ..
                      </button>
                    </td>
                  </tr>
                )}
                {filteredFiles.map((file) => (
                  <tr key={file.path} className="table-row">
                    <td className="px-4 py-2.5">
                      <button onClick={() => handleFileClick(file)}
                        className="flex items-center gap-2 text-sm text-gray-200 hover:text-cavrix-400 transition-colors">
                        {file.type === 'directory' ? <Folder size={16} className="text-cavrix-400 flex-shrink-0" /> : <File size={16} className="text-gray-500 flex-shrink-0" />}
                        <span className="truncate">{file.name}</span>
                      </button>
                    </td>
                    <td className="text-right px-4 py-2.5 text-xs text-gray-500">
                      {file.type === 'file' ? formatBytes(file.size) : '-'}
                    </td>
                    <td className="text-right px-4 py-2.5 text-xs text-gray-500">
                      {formatDateTime(file.modified)}
                    </td>
                    <td className="text-right px-4 py-2.5">
                      <button onClick={() => handleDelete(file)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
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
