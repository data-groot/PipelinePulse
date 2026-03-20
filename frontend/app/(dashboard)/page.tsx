"use client";

import { useQuery } from '@tanstack/react-query';
import { fetchPipelines, fetchQualityScores, fetchRevenueMetrics } from '@/lib/api';
import { usePipelineRunFeed } from '@/lib/websocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatDistanceToNow, subDays, format } from 'date-fns';
import { Database, CheckCircle, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const today = new Date();
  const thirtyDaysAgo = subDays(today, 30);
  
  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
    refetchInterval: 30000,
  });

  const { data: qualityScores, isLoading: loadingQuality } = useQuery({
    queryKey: ['quality-scores'],
    queryFn: fetchQualityScores,
    refetchInterval: 30000,
  });

  const { data: revenueData, isLoading: loadingRevenue } = useQuery({
    queryKey: ['revenue-metrics', format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')],
    queryFn: () => fetchRevenueMetrics(format(thirtyDaysAgo, 'yyyy-MM-dd'), format(today, 'yyyy-MM-dd')),
    refetchInterval: 30000,
  });

  const { events: liveFeed, isConnected } = usePipelineRunFeed();

  // Metrics calculations
  const totalPipelines = pipelines?.length || 0;
  const healthyPipelines = pipelines?.filter((p: any) => p.status === 'success' || p.status === 'running').length || 0;
  
  let avgQuality = 0;
  if (qualityScores?.length > 0) {
    avgQuality = qualityScores.reduce((acc: number, curr: any) => acc + curr.score, 0) / qualityScores.length;
  }

  let lastRunText = "Never";
  if (pipelines?.length > 0) {
    const sorted = [...pipelines].filter(p => p.last_run_time).sort((a, b) => new Date(b.last_run_time).getTime() - new Date(a.last_run_time).getTime());
    if (sorted.length > 0) {
      lastRunText = formatDistanceToNow(new Date(sorted[0].last_run_time), { addSuffix: true });
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'success': return <Badge className="bg-emerald-500 hover:bg-emerald-600">Success</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      case 'running': return <Badge className="bg-blue-500 animate-pulse hover:bg-blue-600">Running</Badge>;
      default: return <Badge variant="secondary">Never Run</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your ETL platform health and metrics.</p>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pipelines</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {loadingPipelines ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{totalPipelines}</div>}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipelines Healthy</CardTitle>
            {healthyPipelines === totalPipelines && totalPipelines > 0 ? (
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </CardHeader>
          <CardContent>
            {loadingPipelines ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{healthyPipelines} / {totalPipelines}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality Score</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingQuality ? <Skeleton className="h-8 w-16" /> : (
              <div className="text-2xl font-bold">{avgQuality.toFixed(1)}%</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingPipelines ? <Skeleton className="h-8 w-32" /> : <div className="text-2xl font-bold capitalize">{lastRunText}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart Section */}
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Revenue Analytics (Last 30 Days)</CardTitle>
          <CardDescription>Daily gross merchandise value and total orders synced from Gold layer.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          {loadingRevenue ? (
            <Skeleton className="h-full w-full" />
          ) : revenueData?.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), 'MMM dd')} />
                <YAxis yAxisId="left" tickFormatter={(val) => `$${val/1000}k`} />
                <YAxis yAxisId="right" orientation="right" />
                <RechartsTooltip labelFormatter={(val) => format(new Date(val), 'MMM dd, yyyy')} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="gmv" stroke="#10b981" strokeWidth={2} name="Total GMV ($)" dot={false} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} name="Total Orders" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">No revenue data available.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Pipeline Status Grid */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium tracking-tight">Pipeline Status</h3>
          {loadingPipelines ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : pipelines?.length === 0 ? (
            <div className="text-muted-foreground">No pipelines configured.</div>
          ) : (
            <div className="grid gap-3 grid-cols-1">
              {pipelines?.map((pipe: any) => (
                <Card key={pipe.id} className="overflow-hidden">
                  <div className={`h-1 w-full ${pipe.enabled ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                  <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{pipe.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">{pipe.schedule}</CardDescription>
                    </div>
                    {getStatusBadge(pipe.enabled ? 'success' : 'never run')}
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-sm grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1">Last Run</span>
                      {pipe.last_run_time ? formatDistanceToNow(new Date(pipe.last_run_time), { addSuffix: true }) : 'N/A'}
                    </div>
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1">Rows Processed</span>
                      {pipe.rows_processed?.toLocaleString() || 'N/A'}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Live Run Feed WebSocket */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium tracking-tight">Live Run Feed</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
              <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-500 shadow-[0_0_8px_theme(colors.emerald.500)] animate-pulse' : 'bg-red-500'}`} />
            </div>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liveFeed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">Listening for events...</TableCell>
                  </TableRow>
                ) : (
                  liveFeed.slice(0, 10).map((event: any, i: number) => (
                    <TableRow key={event.run_id || i} className="animate-in fade-in slide-in-from-top-4 duration-500">
                      <TableCell className="font-medium">{event.pipeline}</TableCell>
                      <TableCell>{getStatusBadge(event.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.started ? formatDistanceToNow(new Date(event.started), { addSuffix: true }) : ''}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">{event.rows?.toLocaleString() || 0}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>
    </div>
  );
}
