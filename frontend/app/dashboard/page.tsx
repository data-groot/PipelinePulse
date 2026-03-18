"use client";

import { useMe } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, ArrowUpRight, Box, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useRunStream } from "@/lib/websocket";

export default function Dashboard() {
  const { data: user } = useMe();
  // Listen to the global stream for realtime dashboard indicators
  useRunStream("*"); 

  const kpis = [
    { title: "Active Pipelines", value: "3", change: "+10%", icon: Box, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Runs (24h)", value: "142", change: "+22%", icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Avg Duration", value: "1m 12s", change: "-5%", icon: Clock, color: "text-purple-500", bg: "bg-purple-500/10" },
    { title: "Failed Runs", value: "2", change: "-1", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  ];

  return (
    <div className="p-8 space-y-8 animate-in-fade">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Overview</h2>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.username}. Here's your pipeline ecosystem at a glance.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <Card key={i} className="glass-card hover-lift border-white/5 transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-full ${kpi.bg}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{kpi.value}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1 text-emerald-500" />
                <span className="text-emerald-500 font-medium">{kpi.change}</span>
                <span className="ml-1">from last week</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 glass-card border-white/5">
          <CardHeader>
            <CardTitle>Execution Duration Matrix</CardTitle>
            <CardDescription>Average pipeline run time over 7 days</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center border-t border-white/5">
            {/* We will add Recharts here soon */}
            <p className="text-muted-foreground animate-pulse flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Loading chart visualizations...
            </p>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 glass-card border-white/5">
          <CardHeader>
            <CardTitle>Recent Activity Stream</CardTitle>
            <CardDescription>Live pipeline updates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                <div className="p-2 bg-emerald-500/10 rounded-full ring-1 ring-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-none">WeatherFlow completed</p>
                  <p className="text-xs text-muted-foreground font-mono">DAG_wf_00{i} • 2m ago</p>
                </div>
                <div className="text-xs font-mono text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                  SUCCESS
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
