"use client";

import { useRun } from "@/lib/api";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Terminal, ChevronLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRunStream } from "@/lib/websocket";

import { useRouter } from "next/navigation";

export default function RunDetail() {
  const router = useRouter();
  const { id } = useParams();
  const runId = id as string;

  const { data: run, isLoading } = useRun(runId);
  useRunStream(runId);

  if (isLoading || !run) {
    return <div className="p-8 text-muted-foreground animate-pulse flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin"/> Streaming live telemetry...</div>;
  }

  const start = new Date(run.started_at);
  const end = run.finished_at ? new Date(run.finished_at) : null;
  const durationSeconds = end ? Math.floor((end.getTime() - start.getTime()) / 1000) : 0;
  
  const StatusIcon = ({ status }: { status: string }) => {
    switch (status.toLowerCase()) {
      case "success": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === "success") return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (s === "running") return "text-blue-500 bg-blue-500/10 border-blue-500/20";
    if (s === "failed") return "text-red-500 bg-red-500/10 border-red-500/20";
    return "text-slate-500 bg-slate-500/10 border-slate-500/20";
  };

  return (
    <div className="p-8 space-y-6 animate-in-slide">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/runs")} className="rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5"/>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight mb-2">Run Execution Trace</h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm px-2 py-0.5 rounded bg-muted border border-border">
              {run.run_id}
            </span>
            <span className="text-sm font-medium text-muted-foreground tracking-wide">
              {run.dag_id}
            </span>
            <Badge variant="outline" className={`font-mono tracking-wider flex items-center gap-1.5 px-2 py-0.5 ${getStatusColor(run.status)}`}>
              <StatusIcon status={run.status} /> {run.status.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card className="glass-card border-white/5 md:col-span-1 border-t-blue-500/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Metatags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Triggered</p>
              <p className="font-medium text-sm mt-1">{format(start, "MMM do, yyyy HH:mm:ss")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDistanceToNow(start, { addSuffix: true })}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium text-sm mt-1">{durationSeconds > 0 ? `${durationSeconds}s` : "In Progress"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rows Exported</p>
              <p className="font-mono text-lg text-primary mt-1">{run.rows_processed?.toLocaleString() || "0"}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-white/5 md:col-span-3 border-t-primary/30 flex flex-col">
          <CardHeader className="flex flex-row items-center gap-2 pb-4 bg-muted/20 border-b border-border/50">
            <Terminal className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <CardTitle>Standard Output Log (Live)</CardTitle>
              <CardDescription>Tail stream from orchestration executor</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {run.status === "RUNNING" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${run.status === "RUNNING" ? "bg-blue-500" : "bg-muted-foreground"}`}></span>
              </span>
              <span className="text-xs font-mono tracking-widest text-muted-foreground uppercase">WebSocket Active</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-black/60 font-mono text-sm leading-relaxed whitespace-pre-wrap">
            <ScrollArea className="h-[400px] w-full p-4 text-green-400/80">
              <div className="pb-4">
                <span className="text-muted-foreground">[sys] INIT Container Executor</span>{"\n"}
                <span className="text-blue-400">[info]</span> Handshake established with worker node.{"\n"}
                <span className="text-blue-400">[info]</span> Pulling source configuration for {run.dag_id}...{"\n"}
                <span className="text-muted-foreground">[sys]</span> Memory allocated: 2048MB.{"\n"}
                <span className="text-blue-400">[info]</span> Starting extraction task...{"\n"}
                {run.rows_processed > 0 && (
                  <>
                    <span className="text-blue-400">[info]</span> Extraction complete. Exported {run.rows_processed} lines to Bronze layer.{"\n"}
                    <span className="text-emerald-400">[succ]</span> Bronze commit verified.{"\n"}
                  </>
                )}
                {run.error_message && (
                  <>
                    <span className="text-red-500">[err!]</span> Stack trace detected:{"\n"}
                    <span className="text-red-400">{run.error_message}</span>{"\n"}
                    <span className="text-muted-foreground">[sys]</span> Aborting transactional state.{"\n"}
                  </>
                )}
                {run.status === "SUCCESS" && (
                  <>
                    <span className="text-emerald-400">[succ]</span> All transformations complete. Dag marked success.{"\n"}
                    <span className="text-muted-foreground">[sys]</span> Task shutdown gracefully.{"\n"}
                  </>
                )}
                {run.status === "RUNNING" && (
                  <span className="animate-pulse">_</span>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
