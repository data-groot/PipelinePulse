"use client";

import { useRuns, usePipelines } from "@/lib/api";
import { useRunStream } from "@/lib/websocket";
import { formatDistanceToNow } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Clock, CheckCircle2, XCircle, PlayCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { useRouter } from "next/navigation";

export function RunTable({ limit, pipelineId }: { limit?: number; pipelineId?: number }) {
  const router = useRouter();
  // Listen for global stream updates and invalidate via react-query internally
  useRunStream("*");
  
  const { data: pipelines } = usePipelines();
  const { data: runs, isLoading } = useRuns({ limit });

  const getPipelineName = (dagId: string) => {
    // Basic mapping: demo seed dags are weather_ingest_dag, orders_ingest_dag, github_ingest_dag
    const map: Record<string, string> = {
      "weather_ingest_dag": "WeatherFlow",
      "orders_ingest_dag": "OrderStream",
      "github_ingest_dag": "GitPulse"
    };
    return map[dagId] || dagId;
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status.toLowerCase()) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const s = status.toLowerCase();
    const color = s === "success" ? "status-success" 
                : s === "running" ? "status-running" 
                : s === "failed" ? "status-failed" 
                : "status-skipped";
    
    return (
      <Badge variant="outline" className={`${color} font-mono tracking-wider flex items-center w-max gap-1.5 px-2 py-0.5`}>
        <StatusIcon status={s} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading execution history...
      </div>
    );
  }

  // Filter if pipelineId is provided (assuming pipeline map)
  let displayRuns = runs || [];
  if (pipelineId && pipelines) {
    const p = pipelines.find((p:any) => p.id === pipelineId);
    if (p) {
      // Very basic filter by matching names if dag_id isn't directly linked conceptually
      // Ideally API handles this, but for UI demo:
      const sourceMap: any = {
        "weatherflow": "weather_ingest_dag",
        "orders": "orders_ingest_dag",
        "github": "github_ingest_dag"
      };
      const expectedDagId = sourceMap[p.source_type];
      displayRuns = displayRuns.filter((r:any) => r.dag_id === expectedDagId);
    }
  }

  return (
    <div className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm overflow-hidden shadow-inner">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="border-white/5 hover:bg-transparent">
            <TableHead className="font-mono text-xs">RUN_ID</TableHead>
            <TableHead>Pipeline</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Records</TableHead>
            <TableHead className="text-right">Started</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayRuns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                No pipeline runs found.
              </TableCell>
            </TableRow>
          ) : (
            displayRuns.map((run: any) => {
              const start = new Date(run.started_at);
              const end = run.finished_at ? new Date(run.finished_at) : new Date();
              const durationSeconds = Math.floor((end.getTime() - start.getTime()) / 1000);
              const m = Math.floor(durationSeconds / 60);
              const s = durationSeconds % 60;

              return (
                <TableRow key={run.id} className="border-white/5 transition-colors hover:bg-muted/30 group">
                  <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">
                    {run.run_id}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getPipelineName(run.dag_id)}
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{run.dag_id}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {run.rows_processed?.toLocaleString() || "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {formatDistanceToNow(start, { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {m > 0 ? `${m}m ` : ''}{s}s
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/runs/${run.run_id}`)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                      View Logs
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
