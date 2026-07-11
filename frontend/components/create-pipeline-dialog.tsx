'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createPipeline, uploadCsv } from '@/lib/api';

const SCHEDULES = [
  { value: '5min', label: 'Every 5 min' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'manual', label: 'Manual only' },
];

export function CreatePipelineDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState('rest_api');
  const [schedule, setSchedule] = useState('daily');
  const [name, setName] = useState('');
  const [config, setConfig] = useState<Record<string, string>>({});
  const [timestampField, setTimestampField] = useState('');
  const [metricField, setMetricField] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const setCfg = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setConfig((c) => ({ ...c, [key]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const pipeline = await createPipeline({
        name,
        source_type: sourceType,
        schedule,
        connection_config: sourceType === 'csv' ? {} : config,
        timestamp_field: timestampField || null,
        metric_field: metricField || null,
      });
      if (sourceType === 'csv' && csvFile) {
        await uploadCsv(pipeline.id, csvFile);
      }
      return pipeline;
    },
    onSuccess: (pipeline) => {
      toast.success(`Pipeline "${pipeline.name}" created`);
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
      setOpen(false);
      setName('');
      setConfig({});
      setCsvFile(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit =
    name.trim() &&
    (sourceType === 'rest_api'
      ? config.url
      : sourceType === 'postgresql'
        ? config.host && config.database && config.user && config.password
        : csvFile);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" /> New Pipeline
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create pipeline</DialogTitle>
          <DialogDescription>
            Connect a source; PipelinePulse extracts, transforms, and quality-checks it on schedule.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pipeline-name">Name</Label>
            <Input
              id="pipeline-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Orders API"
            />
          </div>

          <div className="space-y-2">
            <Label>Source type</Label>
            <Tabs value={sourceType} onValueChange={setSourceType}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="rest_api">REST API</TabsTrigger>
                <TabsTrigger value="postgresql">PostgreSQL</TabsTrigger>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {sourceType === 'rest_api' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="url">API URL</Label>
                <Input
                  id="url"
                  type="url"
                  value={config.url ?? ''}
                  onChange={setCfg('url')}
                  placeholder="https://api.example.com/orders"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api_key">API key (optional, sent as Bearer token)</Label>
                <Input
                  id="api_key"
                  type="password"
                  value={config.api_key ?? ''}
                  onChange={setCfg('api_key')}
                />
              </div>
            </div>
          )}

          {sourceType === 'postgresql' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="host">Host</Label>
                <Input id="host" value={config.host ?? ''} onChange={setCfg('host')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input id="port" value={config.port ?? '5432'} onChange={setCfg('port')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="database">Database</Label>
                <Input id="database" value={config.database ?? ''} onChange={setCfg('database')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="table">Table</Label>
                <Input id="table" value={config.table ?? ''} onChange={setCfg('table')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">User</Label>
                <Input id="user" value={config.user ?? ''} onChange={setCfg('user')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={config.password ?? ''}
                  onChange={setCfg('password')}
                />
              </div>
            </div>
          )}

          {sourceType === 'csv' && (
            <div className="space-y-2">
              <Label htmlFor="csv">CSV file (max 10MB)</Label>
              <Input
                id="csv"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="metric_field">Metric field (optional)</Label>
              <Input
                id="metric_field"
                value={metricField}
                onChange={(e) => setMetricField(e.target.value)}
                placeholder="e.g. amount"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timestamp_field">Timestamp field (optional)</Label>
              <Input
                id="timestamp_field"
                value={timestampField}
                onChange={(e) => setTimestampField(e.target.value)}
                placeholder="e.g. created_at"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The metric field powers sum/average charts; the timestamp field assigns rows to days.
          </p>

          <div className="space-y-2">
            <Label>Schedule</Label>
            <Tabs value={schedule} onValueChange={setSchedule}>
              <TabsList className="grid w-full grid-cols-5">
                {SCHEDULES.map((s) => (
                  <TabsTrigger key={s.value} value={s.value} className="text-xs">
                    {s.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <Button type="submit" className="w-full" disabled={!canSubmit || mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create pipeline'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
