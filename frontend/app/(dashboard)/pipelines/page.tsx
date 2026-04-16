"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPipelines, fetchPipelineRuns, triggerPipeline, togglePipeline, fetchToken, loadSamplePipeline, type Pipeline } from '@/lib/api';
import { CreatePipelineDialog } from '@/components/CreatePipelineDialog';
import { DataPreviewSheet } from '@/components/DataPreviewSheet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Eye, Inbox } from 'lucide-react';

function formatRowCount(count: number | null | undefined): string {
  if (count === null || count === undefined) return 'Run pipeline to see data';
  return `${count.toLocaleString()} rows`;
}

export default function PipelinesPage() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTriggerDagId, setPendingTriggerDagId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Data preview sheet state
  const [previewPipelineId, setPreviewPipelineId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: pipelines, refetch: refetchPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedTab) {
      setSelectedTab(pipelines[0].dag_id);
    }
  }, [pipelines, selectedTab]);

  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ['pipeline-runs', selectedTab],
    queryFn: () => fetchPipelineRuns(selectedTab),
    enabled: !!selectedTab,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ dagId, isActive }: { dagId: string, isActive: boolean }) => togglePipeline(dagId, isActive),
    onMutate: async ({ dagId, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ['pipelines'] });
      const previous = queryClient.getQueryData(['pipelines']);
      queryClient.setQueryData(['pipelines'], (old: any) =>
        old?.map((p: any) => p.dag_id === dagId ? { ...p, enabled: isActive } : p)
      );
      toast(isActive ? 'Pipeline enabled' : 'Pipeline disabled');
      return { previous };
    },
    onError: (_err, _vars, context: any) => {
      queryClient.setQueryData(['pipelines'], context.previous);
      toast.error('Failed to toggle pipeline');
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (dagId: string) => triggerPipeline(dagId),
    onSuccess: (data) => {
      const runId: string = data.dag_run_id ?? data.id ?? '';
      toast.success(`Pipeline started — run ${runId.substring(0, 8)}...`);
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (error: any) => {
      if (error.response?.status === 401) {
        setIsLoginModalOpen(true);
      } else {
        toast.error('Failed to start pipeline run.');
      }
    }
  });

  const loginMutation = useMutation({
    mutationFn: () => fetchToken(username, password),
    onSuccess: (data) => {
      localStorage.setItem('token', data.access_token);
      setIsLoginModalOpen(false);
      toast.success('Login successful!');
      if (pendingTriggerDagId) {
        triggerMutation.mutate(pendingTriggerDagId);
        setPendingTriggerDagId(null);
      }
    },
    onError: () => {
      toast.error('Invalid credentials');
    }
  });

  const sampleMutation = useMutation({
    mutationFn: loadSamplePipeline,
    onSuccess: (_data: Pipeline) => {
      toast.success('Sample pipeline ready! Click Trigger Run to load your first dataset.');
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
    onError: (error: any) => {
      const detail = error?.message ?? 'Failed to create sample pipeline';
      toast.error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    },
  });

  const handleTrigger = (dagId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setPendingTriggerDagId(dagId);
      setIsLoginModalOpen(true);
    } else {
      triggerMutation.mutate(dagId);
    }
  };

  const handleViewData = (pipelineId: number) => {
    setPreviewPipelineId(pipelineId);
    setPreviewOpen(true);
  };

  const statusBadge = (status: string) => {
    if (status === 'success') return <Badge className="bg-emerald-500 hover:bg-emerald-600">Success</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    if (status === 'running') return <Badge className="bg-blue-500 animate-pulse hover:bg-blue-600">Running</Badge>;
    return <Badge variant="secondary">Never Run</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
          <p className="text-muted-foreground">Manage your data ingestion pipelines.</p>
        </div>
        <CreatePipelineDialog onSuccess={refetchPipelines} />
      </div>

      {pipelines && pipelines.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Inbox className="h-12 w-12 text-muted-foreground" />
            <div className="text-center space-y-1">
              <p className="text-lg font-semibold">No pipelines yet</p>
              <p className="text-muted-foreground text-sm max-w-xs">
                Start with sample data to see how PipelinePulse works, or create your own pipeline.
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              <Button
                onClick={() => sampleMutation.mutate()}
                disabled={sampleMutation.isPending}
              >
                {sampleMutation.isPending ? 'Loading...' : 'Load Sample Data'}
              </Button>
              <CreatePipelineDialog onSuccess={refetchPipelines} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {pipelines?.map((pipe: any) => (
            <Card key={pipe.id} className="relative overflow-hidden group">
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${pipe.enabled ? 'bg-primary' : 'bg-muted'} transition-colors duration-300`} />
              <CardHeader className="pl-5 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {pipe.name}
                      {pipe.name?.startsWith('Sample:') && (
                        <Badge className="text-[10px] uppercase font-mono bg-amber-500 hover:bg-amber-600">Sample</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">{pipe.source_type}</Badge>
                      <span className="font-mono text-xs">{pipe.schedule}</span>
                    </CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={pipe.enabled}
                      onCheckedChange={(c) => toggleMutation.mutate({ dagId: pipe.dag_id, isActive: c })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-5">
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Rows Ingested</span>
                    <span className="text-sm font-medium">
                      {formatRowCount(pipe.rows_processed)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Last Run</span>
                    <span className="text-sm font-medium">
                      {pipe.last_run_time
                        ? formatDistanceToNow(new Date(pipe.last_run_time), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTrigger(pipe.dag_id)}
                      disabled={triggerMutation.isPending && triggerMutation.variables === pipe.dag_id}
                    >
                      {triggerMutation.isPending && triggerMutation.variables === pipe.dag_id ? 'Starting...' : 'Run Now'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewData(pipe.id)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1.5" />
                      View Data
                    </Button>
                  </div>
                  {statusBadge(pipe.last_run_status || 'never run')}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelines && pipelines.length > 0 ? (
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                {pipelines.map((p: any) => (
                  <TabsTrigger key={p.id} value={p.dag_id}>{p.name}</TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value={selectedTab} className="border rounded-md shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Rows Ingested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRuns ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24">Loading runs...</TableCell></TableRow>
                    ) : runs?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No runs found for this pipeline.</TableCell></TableRow>
                    ) : (
                      runs?.map((run: any) => (
                        <TableRow key={run.run_id ?? run.id}>
                          <TableCell className="font-mono text-xs" title={run.run_id}>{(run.run_id ?? String(run.id ?? '')).substring(0, 8)}...</TableCell>
                          <TableCell>{statusBadge(run.status)}</TableCell>
                          <TableCell className="text-sm">{run.started_at ? formatDistanceToNow(new Date(run.started_at), { addSuffix: true }) : '-'}</TableCell>
                          <TableCell className="text-sm">{run.finished_at && run.started_at ? `${Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime())/1000)}s` : '-'}</TableCell>
                          <TableCell className="text-right font-mono">
                            {run.rows_processed != null ? run.rows_processed.toLocaleString() : '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-muted-foreground py-4 text-center">No pipelines configured yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Data Preview Sheet */}
      <DataPreviewSheet
        pipelineId={previewPipelineId}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {/* Auth Modal (only shown when triggering without a token) */}
      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button className="w-full" onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending}>
              {loginMutation.isPending ? 'Authenticating...' : 'Login & Run Pipeline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
