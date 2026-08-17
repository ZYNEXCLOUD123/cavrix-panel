import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const token = localStorage.getItem('cavrix_token');
  const WS_URL = import.meta.env.VITE_WS_URL || '';

  socket = io(WS_URL || undefined, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[CAVRIX] WebSocket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('[CAVRIX] WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[CAVRIX] WebSocket error:', error.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
