'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Database, Eye, Play, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreatePipelineDialog } from '@/components/create-pipeline-dialog';
import { RunStatusBadge } from '@/components/run-status-badge';
import {
  createSamplePipeline,
  deletePipeline,
  fetchPipelines,
  fetchPreview,
  fetchRuns,
  togglePipeline,
  triggerPipeline,
} from '@/lib/api';

export default function PipelinesPage() {
  const queryClient = useQueryClient();
  const { data: pipelines, isLoading } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  const [historyId, setHistoryId] = useState<number | null>(null);
  const historyPipelineId = historyId ?? pipelines?.[0]?.id ?? null;
  const { data: runs } = useQuery({
    queryKey: ['runs', historyPipelineId],
    queryFn: () => fetchRuns(historyPipelineId!),
    enabled: historyPipelineId != null,
    refetchInterval: 10000,
  });

  const [previewId, setPreviewId] = useState<number | null>(null);
  const { data: preview } = useQuery({
    queryKey: ['preview', previewId],
    queryFn: () => fetchPreview(previewId!),
    enabled: previewId != null,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    queryClient.invalidateQueries({ queryKey: ['runs'] });
    queryClient.invalidateQueries({ queryKey: ['overview'] });
  };

  const trigger = useMutation({
    mutationFn: triggerPipeline,
    onSuccess: (run) => {
      if (run.status === 'success') {
        toast.success(`Run finished — ${run.rows_processed} rows processed`);
      } else {
        toast.error(`Run failed: ${run.error_message ?? 'unknown error'}`);
      }
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggle = useMutation({
    mutationFn: togglePipeline,
    onSuccess: (p) => {
      toast.success(p.enabled ? `${p.name} enabled` : `${p.name} paused`);
      invalidateAll();
    },
  });

  const remove = useMutation({
    mutationFn: deletePipeline,
    onSuccess: () => {
      toast.success('Pipeline deleted');
      invalidateAll();
    },
  });

  const sample = useMutation({
    mutationFn: createSamplePipeline,
    onSuccess: (p) => {
      toast.success(`"${p.name}" created — press Run to pull data`);
      invalidateAll();
    },
  });

  const previewPipeline = pipelines?.find((p) => p.id === previewId);
  const previewColumns =
    preview?.rows?.[0]?.payload != null ? Object.keys(preview.rows[0].payload).slice(0, 6) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground text-sm">
            Create, run, and monitor your data pipelines.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => sample.mutate()}
            disabled={sample.isPending}
          >
            <Sparkles className="h-4 w-4" /> Load sample
          </Button>
          <CreatePipelineDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {pipelines?.map((p) => (
          <Card key={p.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{p.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1 text-xs">
                    <Database className="h-3 w-3" /> {p.source_type} · {p.schedule}
                  </CardDescription>
                </div>
                <Switch
                  checked={p.enabled}
                  onCheckedChange={() => toggle.mutate(p.id)}
                  aria-label="Enable pipeline"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {p.last_run_at
                    ? `Last run ${formatDistanceToNow(new Date(p.last_run_at), { addSuffix: true })}`
                    : 'Never run'}
                </span>
                {p.last_run_status && <RunStatusBadge status={p.last_run_status} />}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => trigger.mutate(p.id)}
                  disabled={trigger.isPending}
                >
                  <Play className="h-3.5 w-3.5" />
                  {trigger.isPending && trigger.variables === p.id ? 'Running…' : 'Run now'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPreviewId(p.id)}>
                  <Eye className="h-3.5 w-3.5" /> Data
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${p.name}" and all its data?`)) remove.mutate(p.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {pipelines?.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-muted-foreground">
                No pipelines yet. Load the sample to see PipelinePulse in action, or create your
                own.
              </p>
              <Button onClick={() => sample.mutate()} disabled={sample.isPending}>
                <Sparkles className="h-4 w-4" /> Load sample pipeline
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {pipelines && pipelines.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Run History</CardTitle>
              {pipelines.length > 1 && (
                <Tabs
                  value={String(historyPipelineId)}
                  onValueChange={(v) => setHistoryId(Number(v))}
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs?.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">#{run.id}</TableCell>
                    <TableCell>
                      <RunStatusBadge status={run.status} />
                      {run.error_message && (
                        <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                          {run.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{run.trigger}</TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(run.started_at), 'MMM d, HH:mm:ss')}
                    </TableCell>
                    <TableCell className="text-right text-xs">{run.rows_processed}</TableCell>
                  </TableRow>
                ))}
                {runs?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No runs for this pipeline yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={previewId != null} onOpenChange={(open) => !open && setPreviewId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>Bronze data — {previewPipeline?.name}</SheetTitle>
          </SheetHeader>
          {preview && preview.rows.length > 0 ? (
            <div className="overflow-x-auto px-4 pb-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewColumns.map((c) => (
                      <TableHead key={c} className="text-xs">
                        {c}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row, i) => (
                    <TableRow key={i}>
                      {previewColumns.map((c) => (
                        <TableCell key={c} className="max-w-40 truncate text-xs">
                          {JSON.stringify(row.payload?.[c])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="px-4 text-sm text-muted-foreground">
              No data yet — trigger a run first.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
