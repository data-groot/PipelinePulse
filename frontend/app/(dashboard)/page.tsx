"use client";

import { useQuery } from '@tanstack/react-query';
import { fetchPipelines, fetchAvgQuality, fetchRevenueMetrics } from '@/lib/api';
import { usePipelineRunFeed } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatDistanceToNow, subDays, format } from 'date-fns';
import { Database, CheckCircle, AlertTriangle, Clock, ShieldCheck, Activity, ListTree } from 'lucide-react';

export default function DashboardPage() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
    refetchInterval: 30000,
  });

  const { data: avgQualityData, isLoading: loadingQuality } = useQuery({
    queryKey: ['avg-quality'],
    queryFn: fetchAvgQuality,
    refetchInterval: 30000,
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenue-metrics', format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')],
    queryFn: () => fetchRevenueMetrics(format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')),
    refetchInterval: 30000,
  });

  // Build a dag_id → pipeline name lookup map so the live feed
  // shows human pipeline names instead of raw identifiers.
  const dagIdToName: Record<string, string> = {};
  if (pipelines) {
    for (const p of pipelines) {
      if (p.dag_id) dagIdToName[p.dag_id] = p.name;
    }
  }

  const { events: liveFeed, isConnected } = usePipelineRunFeed(dagIdToName);

  // Metrics calculations
  const totalPipelines = pipelines?.length || 0;
  const healthyPipelines =
    pipelines?.filter(
      (p: any) => p.last_run_status === 'success' || p.last_run_status === 'running'
    ).length || 0;

  const avgQualityPct = avgQualityData?.avg_score_pct ?? 0;

  let lastRunText = 'Never';
  if (pipelines?.length > 0) {
    const sorted = [...pipelines]
      .filter((p: any) => p.last_run_time)
      .sort(
        (a: any, b: any) =>
          new Date(b.last_run_time).getTime() - new Date(a.last_run_time).getTime()
      );
    if (sorted.length > 0) {
      lastRunText = formatDistanceToNow(new Date(sorted[0].last_run_time), {
        addSuffix: true,
      });
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'success':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Success</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500 animate-pulse hover:bg-blue-600">Running</Badge>;
      default:
        return <Badge variant="secondary">Never Run</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in-slide">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] -z-10" />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-8 bg-primary rounded-full" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">System Overview</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-glow">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Real-time health telemetry for your data ecosystem.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass border-white/5">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_theme(colors.emerald.500)]' : 'bg-red-500'}`} />
            <span className="text-[10px] font-mono uppercase tracking-wider">{isConnected ? 'Uplink Active' : 'Uplink Offline'}</span>
          </div>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Pipelines", value: totalPipelines, icon: Database, color: "text-blue-400", loading: loadingPipelines },
          { 
            title: "Pipelines Healthy", 
            value: `${healthyPipelines} / ${totalPipelines}`, 
            icon: healthyPipelines === totalPipelines && totalPipelines > 0 ? CheckCircle : AlertTriangle,
            color: healthyPipelines === totalPipelines ? "text-emerald-400" : "text-amber-400",
            loading: loadingPipelines 
          },
          { 
            title: "Quality Score", 
            value: avgQualityData && avgQualityData.check_count > 0 ? `${avgQualityPct.toFixed(1)}%` : 'N/A', 
            icon: ShieldCheck, 
            color: "text-primary",
            loading: loadingQuality 
          },
          { title: "Last Activity", value: lastRunText, icon: Clock, color: "text-purple-400", loading: loadingPipelines }
        ].map((kpi, i) => (
          <Card key={i} className="glass-card hover-lift overflow-hidden group">
            <div className={`absolute top-0 left-0 w-1 h-full ${kpi.color.replace('text', 'bg')} opacity-50`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color} group-hover:scale-110 transition-transform`} />
            </CardHeader>
            <CardContent>
              {kpi.loading ? (
                <Skeleton className="h-8 w-20 bg-white/5" />
              ) : (
                <div className="text-2xl font-bold tracking-tight">{kpi.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart Section */}
        <Card className="lg:col-span-2 glass-card overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Revenue Pulse</CardTitle>
                <CardDescription className="text-xs">30-day economic throughput analytics</CardDescription>
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Revenue</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-muted-foreground uppercase font-mono">Orders</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="h-[350px] p-6 pt-8">
            {loadingRevenue ? (
              <Skeleton className="h-full w-full bg-white/5" />
            ) : revenueData?.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(val) => format(new Date(val), 'MMM dd')}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-jetbrains)' }}
                  />
                  <YAxis 
                    yAxisId="left" 
                    tickFormatter={(val) => `$${val / 1000}k`}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-jetbrains)' }}
                  />
                  <YAxis yAxisId="right" orientation="right" hide />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: 'rgba(13, 23, 40, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', marginBottom: '4px' }}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total_revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#10b981', strokeWidth: 0 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="successful_orders"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground font-mono text-xs uppercase tracking-wider">
                No telemetry data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Live Run Feed */}
        <Card className="glass-card flex flex-col overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Live Events
            </CardTitle>
            <CardDescription className="text-xs">Real-time execution stream</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto custom-scrollbar">
            <Table>
              <TableBody>
                {liveFeed.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-center h-40 text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
                      Establishing connection...
                    </TableCell>
                  </TableRow>
                ) : (
                  liveFeed.slice(0, 12).map((event: any, i: number) => (
                    <TableRow key={event.run_id || i} className="border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <TableCell className="py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-xs">{event.pipeline}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {event.started ? format(new Date(event.started), 'HH:mm:ss') : '--:--:--'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3">
                        <div className={`text-[10px] px-2 py-0.5 rounded-full inline-flex font-mono uppercase tracking-tighter ${
                          event.status === 'success' ? 'status-success' : 
                          event.status === 'running' ? 'status-running' : 'status-failed'
                        }`}>
                          {event.status}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status Grid */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ListTree className="h-4 w-4 text-primary" />
          <h3 className="text-lg font-bold tracking-tight text-glow">Managed Pipelines</h3>
        </div>
        
        {loadingPipelines ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full glass-card" />)}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pipelines?.map((pipe: any) => (
              <Card key={pipe.id} className="glass-card hover-lift group relative overflow-hidden">
                <div className={`absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity`}>
                   <Database size={48} />
                </div>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">{pipe.name}</CardTitle>
                      <CardDescription className="text-[10px] font-mono uppercase tracking-widest mt-1">
                        {pipe.schedule}
                      </CardDescription>
                    </div>
                    {getStatusBadge(pipe.last_run_status || 'never run')}
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground block">Rows Processed</span>
                      <span className="text-sm font-bold tracking-tight">
                        {pipe.rows_processed?.toLocaleString() || '0'}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] font-mono uppercase text-muted-foreground block">Health State</span>
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${pipe.enabled ? 'bg-emerald-500' : 'bg-muted'}`} />
                        <span className="text-xs">{pipe.enabled ? 'Enabled' : 'Paused'}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
