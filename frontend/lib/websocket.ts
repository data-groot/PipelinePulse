"use client";

import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

type StreamStatus = "connecting" | "connected" | "disconnected" | "error";

export function useRunStream(runId: string = "*") {
  const [status, setStatus] = useState<StreamStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!runId) return;

    // Connect
    const url = `${WS_BASE}/ws/runs/${runId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => setStatus("connected");
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "run_updated" || data.event === "run_created") {
          // Immediately refetch queries referencing this run or the general runs list
          queryClient.invalidateQueries({ queryKey: ["runs"] });
        }
      } catch (err) {
        console.error("WebSocket message parse error", err);
      }
    };

    ws.onerror = () => setStatus("error");
    
    ws.onclose = () => setStatus("disconnected");

    // Cleanup
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [runId, queryClient]);

  // Provide a function to send pings/acks
  const sendMessage = (msg: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  return { status, sendMessage };
}
