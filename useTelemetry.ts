import { useState, useEffect, useCallback } from 'react';
import type { TelemetryData } from '@/types';
import { getSocket } from '@/lib/socket';

export function useTelemetry(): TelemetryData {
  const [data, setData] = useState<TelemetryData>({
    cpu: { current: 0, average: 0, peak: 0 },
    ram: { current: 0, used: 0, total: 0 },
    disk: { used: 0, available: 0, total: 0 },
    network: { rx: 0, tx: 0 },
    uptime: 0,
    load: [0, 0, 0],
    containers: { total: 0, running: 0, stopped: 0 },
  });

  useEffect(() => {
    const socket = getSocket();

    socket.on('telemetry:data', (newData: TelemetryData) => {
      setData(newData);
    });

    socket.emit('telemetry:request');

    const interval = setInterval(() => {
      socket.emit('telemetry:request');
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.off('telemetry:data');
    };
  }, []);

  return data;
}
