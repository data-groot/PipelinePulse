'use client';

import { useState, useEffect } from 'react';

export interface RunEvent {
  pipeline: string;
  status: string;
  started: string;
  duration: number;
  rows: number;
}

export function usePipelineRunFeed() {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: NodeJS.Timeout;
    let attempt = 0;

    const connect = () => {
      const wsBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';
      const wsUrl = `${wsBase.replace(/\/$/, '')}/ws/pipeline-runs`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        attempt = 0;
      };

      ws.onmessage = (event) => {
        try {
          const rawData = JSON.parse(event.data);
          if (Array.isArray(rawData)) {
            const mapped = rawData.map((r: any) => ({
              run_id: r.id,
              pipeline: r.dag_id,
              status: r.status,
              started: r.start_time,
              duration: r.end_time && r.start_time ? Math.round((new Date(r.end_time).getTime() - new Date(r.start_time).getTime())/1000) : 0,
              rows: r.rows_processed || 0
            }));
            setEvents(mapped);
          }
        } catch (e) {
          console.error("Failed to parse message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
        attempt++;
        reconnectTimeout = setTimeout(connect, backoff);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        ws.close();
      };
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      if (ws) {
        // Clear onclose so it doesn't try to reconnect when unmounted 
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  return { events, isConnected };
}
