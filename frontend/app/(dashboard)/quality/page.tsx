'use client';

import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RunStatusBadge } from '@/components/run-status-badge';
import { fetchQualityAlerts, fetchQualityScores, fetchQualitySummary } from '@/lib/api';

const CHECK_LABELS: Record<string, string> = {
  row_count_nonzero: 'Row count',
  no_null_payloads: 'Null payloads',
  low_duplicates: 'Duplicates',
  freshness: 'Freshness',
};

export default function QualityPage() {
  const { data: summary } = useQuery({
    queryKey: ['quality', 'summary'],
    queryFn: fetchQualitySummary,
  });
  const { data: scores } = useQuery({
    queryKey: ['quality', 'scores'],
    queryFn: fetchQualityScores,
    refetchInterval: 30000,
  });
  const { data: alerts } = useQuery({
    queryKey: ['quality', 'alerts'],
    queryFn: fetchQualityAlerts,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground text-sm">
          Automated checks scored after every pipeline run.
        </p>
      </div>

      {alerts && alerts.length > 0 ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {alerts.length} failing check{alerts.length > 1 ? 's' : ''} in the last 24 hours
          </AlertTitle>
          <AlertDescription>
            {alerts.slice(0, 3).map((a) => (
              <span key={a.id} className="block text-xs">
                {a.pipeline_name}: {CHECK_LABELS[a.check_name] ?? a.check_name} failed{' '}
                {formatDistanceToNow(new Date(a.checked_at), { addSuffix: true })}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>All checks passing</AlertTitle>
          <AlertDescription>
            {summary?.avg_score_pct != null
              ? `Average quality score over the last 7 days: ${summary.avg_score_pct}%`
              : 'Run a pipeline to start collecting quality scores.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Latest check results</CardTitle>
          <CardDescription>Most recent result for each pipeline and check</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pipeline</TableHead>
                <TableHead>Check</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Checked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scores?.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.pipeline_name}</TableCell>
                  <TableCell>{CHECK_LABELS[s.check_name] ?? s.check_name}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {(s.score * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell>
                    <RunStatusBadge status={s.passed ? 'success' : 'failed'} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-xs text-muted-foreground">
                    {s.details ? JSON.stringify(s.details) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {format(new Date(s.checked_at), 'MMM d, HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
              {scores?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No quality data yet — trigger a pipeline run first.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
