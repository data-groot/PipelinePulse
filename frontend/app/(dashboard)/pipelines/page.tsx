"use client";

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPipelines, fetchPipelineRuns, triggerPipeline, togglePipeline, fetchToken } from '@/lib/api';
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

export default function PipelinesPage() {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<string>('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTriggerDagId, setPendingTriggerDagId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { data: pipelines, isLoading: loadingPipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  useEffect(() => {
    if (pipelines && pipelines.length > 0 && !selectedTab) {
      setSelectedTab(pipelines[0].name);
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
        old?.map((p: any) => p.name === dagId ? { ...p, enabled: isActive } : p)
      );
      toast(isActive ? 'Pipeline enabled' : 'Pipeline disabled');
      return { previous };
    },
    onError: (err, newTodo, context: any) => {
      queryClient.setQueryData(['pipelines'], context.previous);
      toast.error('Failed to toggle pipeline');
    },
  });

  const triggerMutation = useMutation({
    mutationFn: (dagId: string) => triggerPipeline(dagId),
    onSuccess: (data) => {
      toast.success(`Pipeline triggered — run ID: ${data.id.substring(0, 8)}...`);
      queryClient.invalidateQueries({ queryKey: ['pipeline-runs'] });
      queryClient.invalidateQueries({ queryKey: ['pipelines'] }); // force status reload
    },
    onError: (error: any) => {
      if (error.response?.status === 401) {
        setIsLoginModalOpen(true);
      } else {
        toast.error('Failed to trigger pipeline natively.');
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

  const handleTrigger = (dagId: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      setPendingTriggerDagId(dagId);
      setIsLoginModalOpen(true);
    } else {
      triggerMutation.mutate(dagId);
    }
  };

  const getSourceType = (dagId: string) => {
    if (dagId.includes('weather')) return 'REST API';
    if (dagId.includes('order')) return 'PostgreSQL';
    if (dagId.includes('github')) return 'GraphQL';
    return 'Unknown';
  };

  const getDescription = (dagId: string) => {
    if (dagId.includes('weather')) return 'WeatherFlow - Ingests hourly meteorological forecasts.';
    if (dagId.includes('order')) return 'OrderStream - Migrates transactional e-commerce data.';
    if (dagId.includes('github')) return 'GitPulse - Syncs daily commit and repository statistics.';
    return 'Data pipeline orchestration workflow.';
  };

  const statusBadge = (status: string) => {
    if (status === 'success') return <Badge className="bg-emerald-500 hover:bg-emerald-600">Success</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
    if (status === 'running') return <Badge className="bg-blue-500 animate-pulse hover:bg-blue-600">Running</Badge>;
    return <Badge variant="secondary">Never Run</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pipelines</h1>
        <p className="text-muted-foreground">Manage and orchestrate your Airflow ingestion workflows.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {pipelines?.map((pipe: any) => (
          <Card key={pipe.id} className="relative overflow-hidden group">
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${pipe.enabled ? 'bg-primary' : 'bg-muted'} transition-colors duration-300`} />
            <CardHeader className="pl-5 pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{pipe.name}</CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">{getSourceType(pipe.name)}</Badge>
                    <span className="font-mono text-xs">{pipe.schedule}</span>
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={pipe.enabled} 
                    onCheckedChange={(c) => toggleMutation.mutate({ dagId: pipe.name, isActive: c })}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pl-5">
              <p className="text-sm text-muted-foreground mb-4 pr-2">{getDescription(pipe.name)}</p>
              <div className="flex items-center justify-between mt-2">
                <Button variant="secondary" size="sm" onClick={() => handleTrigger(pipe.name)} disabled={triggerMutation.isPending && triggerMutation.variables === pipe.name}>
                  {triggerMutation.isPending && triggerMutation.variables === pipe.name ? 'Triggering...' : 'Trigger Run'}
                </Button>
                {statusBadge(pipe.enabled ? 'success' : 'never run')}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {pipelines && pipelines.length > 0 ? (
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                {pipelines.map((p: any) => (
                  <TabsTrigger key={p.id} value={p.name}>{p.name}</TabsTrigger>
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
                      <TableHead className="text-right">Rows</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingRuns ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24">Loading runs...</TableCell></TableRow>
                    ) : runs?.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center h-24 text-muted-foreground">No runs found for this pipeline.</TableCell></TableRow>
                    ) : (
                      runs?.map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-mono text-xs" title={run.id}>{run.id.substring(0, 8)}...</TableCell>
                          <TableCell>{statusBadge(run.status)}</TableCell>
                          <TableCell className="text-sm">{run.start_time ? formatDistanceToNow(new Date(run.start_time), { addSuffix: true }) : '-'}</TableCell>
                          <TableCell className="text-sm">{run.end_time && run.start_time ? `${Math.round((new Date(run.end_time).getTime() - new Date(run.start_time).getTime())/1000)}s` : '-'}</TableCell>
                          <TableCell className="text-right font-mono">{run.rows_processed?.toLocaleString() || 0}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          ) : (
            <p className="text-muted-foreground py-4 text-center">No pipelines available.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={isLoginModalOpen} onOpenChange={setIsLoginModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin Authentication Required</DialogTitle>
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
              {loginMutation.isPending ? 'Authenticating...' : 'Login & Trigger Pipeline'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
