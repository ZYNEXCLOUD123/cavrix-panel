import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Download, Trash2, Search, Pause, Play } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { Server } from '@/types';

export default function ConsoleTab({ server }: { server: Server }) {
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // Load existing logs
    api.get(`/console/${server.id}/logs`).then((res: any) => {
      if (res.success && res.data) setLogs(String(res.data));
    }).catch(() => {});

    const socket = getSocket();
    socket.emit('join:server', server.id);

    const handleLog = (data: { serverId: string; data: string }) => {
      if (data.serverId === server.id) {
        setLogs((prev) => prev + data.data);
      }
    };

    socket.on('console:log', handleLog);

    return () => {
      socket.emit('leave:server', server.id);
      socket.off('console:log', handleLog);
    };
  }, [server.id]);

  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const socket = getSocket();
    socket.emit('console:command', { serverId: server.id, command: command.trim() });
    setLogs((prev) => prev + `\n> ${command}\n`);
    setCommand('');
  };

  const handleClear = () => setLogs('');

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${server.name}-console-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = searchTerm
    ? logs.split('\n').filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase())).join('\n')
    : logs;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowSearch(!showSearch)} className="btn-secondary text-xs">
          <Search size={14} /> Search
        </button>
        <button onClick={() => setAutoScroll(!autoScroll)} className="btn-secondary text-xs">
          {autoScroll ? <Pause size={14} /> : <Play size={14} />}
          {autoScroll ? 'Pause' : 'Resume'}
        </button>
        <button onClick={handleClear} className="btn-secondary text-xs">
          <Trash2 size={14} /> Clear
        </button>
        <button onClick={handleDownload} className="btn-secondary text-xs">
          <Download size={14} /> Download
        </button>
      </div>

      {showSearch && (
        <input
          type="text"
          className="input text-sm"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      )}

      {/* Console Output */}
      <div className="card overflow-hidden">
        <pre
          ref={logRef}
          className="p-4 font-mono text-xs leading-relaxed text-gray-300 overflow-auto max-h-[500px] min-h-[300px] bg-surface-0"
        >
          {filteredLogs || (
            <span className="text-gray-500">
              {server.status === 'running' ? 'Connecting to console...' : 'Server is not running. Start the server to see console output.'}
            </span>
          )}
        </pre>
      </div>

      {/* Command Input */}
      {server.status === 'running' && (
        <form onSubmit={handleSendCommand} className="flex gap-2">
          <input
            type="text"
            className="input font-mono"
            placeholder="Type a command..."
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <button type="submit" className="btn-primary">
            <Terminal size={14} /> Send
          </button>
        </form>
      )}
    </div>
  );
}


