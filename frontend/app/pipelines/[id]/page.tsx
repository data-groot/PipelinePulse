"use client";

import { usePipeline, useRuns } from "@/lib/api";
import { RunTable } from "@/components/pipeline/run-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Clock, Database, ChevronLeft, Power, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { format } from "date-fns";
import { useRouter, useParams } from "next/navigation";

export default function PipelineDetail() {
  const router = useRouter();
  const { id } = useParams();
  const pipelineId = id ? parseInt(id as string, 10) : 0;
  
  const { data: pipeline, isLoading: isPipelineLoading } = usePipeline(pipelineId);
  const { data: runs } = useRuns({ limit: 30 }); // Get runs to build chart

  if (isPipelineLoading || !pipeline) {
    return <div className="p-8 text-muted-foreground animate-pulse flex items-center gap-2"><Activity className="h-5 w-5"/> Loading ecosystem data...</div>;
  }

  // Derive source mapping to find runs
  const sourceMap: any = {
    "weatherflow": "weather_ingest_dag",
    "orders": "orders_ingest_dag",
    "github": "github_ingest_dag"
  };
  const expectedDagId = sourceMap[pipeline.source_type];
  const pipelineRuns = (runs || []).filter((r:any) => r.dag_id === expectedDagId).slice(0, 20).reverse();

  // Map to chart data
  const chartData = pipelineRuns.map((r:any) => {
    const start = new Date(r.started_at);
    const end = r.finished_at ? new Date(r.finished_at) : new Date();
    const duration = Math.floor((end.getTime() - start.getTime()) / 1000); // seconds
    return {
      name: format(start, "HH:mm"),
      duration: duration,
      rows: r.rows_processed || 0,
    };
  });

  return (
    <div className="p-8 space-y-6 animate-in-slide">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/pipelines")} className="rounded-full hover:bg-muted">
          <ChevronLeft className="h-5 w-5"/>
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight">{pipeline.name}</h2>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><Box className="h-4 w-4"/> {pipeline.source_type}</span>
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4"/> {pipeline.schedule}</span>
            <span className={`flex items-center gap-1.5 font-medium ${pipeline.enabled ? "text-emerald-500" : "text-muted-foreground"}`}>
              <Power className="h-4 w-4"/> {pipeline.enabled ? "Active" : "Paused"}
            </span>
          </div>
        </div>
        <Button className="hover-lift bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]">
          Trigger Run
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass-card lg:col-span-2 border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Execution Duration (Seconds)
            </CardTitle>
            <CardDescription>Latency trend for the last 20 operations</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] w-full mt-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorDuration" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(var(--background), 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                  <Area type="monotone" dataKey="duration" stroke="var(--primary)" strokeWidth={2} fillOpacity={1} fill="url(#colorDuration)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">Awaiting telemetric data...</div>
            )}
          </CardContent>
        </Card>
        
        <Card className="glass-card border-white/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" /> Volume Processed
            </CardTitle>
            <CardDescription>Rows ingested over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[250px] w-full mt-4">
             {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(var(--background), 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                  />
                  <Area type="step" dataKey="rows" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorRows)" />
                </AreaChart>
              </ResponsiveContainer>
             ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono text-sm">No volume data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-bold mb-4 tracking-tight">Run History</h3>
        <RunTable pipelineId={pipelineId} />
      </div>
    </div>
  );
}
