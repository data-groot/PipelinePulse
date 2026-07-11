'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { Activity, CheckCircle2, Gauge, ListTree } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  fetchDailyMetrics,
  fetchOverview,
  fetchPipelines,
  fetchRuns,
  type Run,
} from '@/lib/api';
import { RunStatusBadge } from '@/components/run-status-badge';

export default function DashboardPage() {
  const { data: overview } = useQuery({ queryKey: ['overview'], queryFn: fetchOverview });
  const { data: pipelines } = useQuery({ queryKey: ['pipelines'], queryFn: fetchPipelines });
  const { data: runs } = useQuery({
    queryKey: ['runs', 'feed'],
    queryFn: () => fetchRuns(undefined, 15),
    refetchInterval: 5000,
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const chartPipelineId = selectedId ?? pipelines?.[0]?.id ?? null;
  const chartPipeline = pipelines?.find((p) => p.id === chartPipelineId);

  const { data: daily } = useQuery({
    queryKey: ['daily', chartPipelineId],
    queryFn: () => fetchDailyMetrics(chartPipelineId!),
    enabled: chartPipelineId != null,
  });

  const hasMetric = useMemo(() => daily?.some((d) => d.metric_sum != null), [daily]);

  const kpis = [
    { title: 'Total Pipelines', value: overview?.total_pipelines, icon: ListTree },
    { title: 'Healthy', value: overview?.healthy_pipelines, icon: CheckCircle2 },
    {
      title: 'Quality Score',
      value: overview?.avg_quality_score != null ? `${overview.avg_quality_score}%` : '—',
      icon: Gauge,
    },
    {
      title: 'Last Activity',
      value: overview?.last_activity
        ? formatDistanceToNow(new Date(overview.last_activity), { addSuffix: true })
        : '—',
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Live view of your pipelines, data volume, and quality.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {kpi.value === undefined ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                <div className="text-2xl font-bold">{kpi.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Daily Volume</CardTitle>
                <CardDescription>
                  {hasMetric
                    ? `Daily sum of "${chartPipeline?.metric_field ?? 'metric'}" (gold layer)`
                    : 'Rows processed per day (gold layer)'}
                </CardDescription>
              </div>
              {pipelines && pipelines.length > 1 && (
                <Tabs
                  value={String(chartPipelineId)}
                  onValueChange={(v) => setSelectedId(Number(v))}
                >
                  <TabsList>
                    {pipelines.slice(0, 4).map((p) => (
                      <TabsTrigger key={p.id} value={String(p.id)} className="max-w-32 truncate">
                        {p.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </div>
          </CardHeader>
          <CardContent className="h-72">
            {daily && daily.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillRows" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : Math.abs(v) >= 1_000
                          ? `${(v / 1_000).toFixed(0)}k`
                          : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={hasMetric ? 'metric_sum' : 'row_count'}
                    name={hasMetric ? chartPipeline?.metric_field ?? 'metric' : 'rows'}
                    stroke="var(--primary)"
                    fill="url(#fillRows)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Run a pipeline to see daily aggregates here.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Runs</CardTitle>
            <CardDescription>Updates every 5 seconds</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {runs && runs.length > 0 ? (
              runs.slice(0, 8).map((run: Run) => (
                <div key={run.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{run.pipeline_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })} ·{' '}
                      {run.rows_processed} rows · {run.trigger}
                    </p>
                  </div>
                  <RunStatusBadge status={run.status} />
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No runs yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines?.map((p) => (
            <div key={p.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{p.name}</p>
                <Badge variant={p.enabled ? 'default' : 'secondary'}>
                  {p.enabled ? 'active' : 'paused'}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.source_type} · {p.schedule} · {p.rows_processed} rows last run
              </p>
              {p.last_run_status && (
                <div className="mt-2">
                  <RunStatusBadge status={p.last_run_status} />
                </div>
              )}
            </div>
          ))}
          {pipelines?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No pipelines yet — create one on the Pipelines page.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
