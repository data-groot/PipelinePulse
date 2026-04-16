"use client";

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchQualityAlerts, fetchQualityScores } from '@/lib/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// Backend contract: QualityScoreItem
// { table_name: string, check_name: string, passed: boolean, score: number | null, run_at: string | null }
// There is NO measured_at, schema_layer, or status field on this schema.

type QualityScoreItem = {
  id?: number;
  table_name: string;
  check_name: string;
  passed: boolean;
  score: number | null;
  run_at: string | null;
};

function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function safeFormatDistance(value: string | null | undefined): string {
  const d = safeDate(value);
  if (!d) return 'No data yet';
  return formatDistanceToNow(d, { addSuffix: true });
}

function safeFormat(value: string | null | undefined, fmt: string): string {
  const d = safeDate(value);
  if (!d) return 'No data';
  return format(d, fmt);
}

function safeScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'N/A';
  return score.toFixed(1) + '%';
}

export default function QualityPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);

  const { data: alerts, isLoading: loadingAlerts } = useQuery({
    queryKey: ['quality-alerts'],
    queryFn: fetchQualityAlerts,
    refetchInterval: 60000,
  });

  const { data: scores, isLoading: loadingScores } = useQuery({
    queryKey: ['quality-scores'],
    queryFn: fetchQualityScores,
    refetchInterval: 60000,
  });

  // Deduplicate to one row per table_name + check_name, keeping the latest run_at.
  const latestScores = new Map<string, QualityScoreItem>();
  if (scores) {
    [...(scores as QualityScoreItem[])]
      .sort((a, b) => {
        const da = safeDate(a.run_at)?.getTime() ?? 0;
        const db = safeDate(b.run_at)?.getTime() ?? 0;
        return da - db;
      })
      .forEach(s => {
        const key = `${s.table_name}-${s.check_name}`;
        latestScores.set(key, s);
      });
  }

  const tableData = Array.from(latestScores.values()).sort((a, b) => {
    // Failed rows first, then alphabetical by table name.
    if (a.passed !== b.passed) return a.passed ? 1 : -1;
    return a.table_name.localeCompare(b.table_name);
  });

  const getStatusVariant = (passed: boolean): 'destructive' | 'default' =>
    passed ? 'default' : 'destructive';

  const getStatusLabel = (passed: boolean) => (passed ? 'passed' : 'failed');

  const getStatusClassName = (passed: boolean) =>
    passed ? 'bg-emerald-500 hover:bg-emerald-600' : '';

  const renderTrendChart = (tableName: string) => {
    if (!scores) return null;
    const tableHistory = (scores as QualityScoreItem[])
      .filter(s => s.table_name === tableName)
      .sort((a, b) => {
        const da = safeDate(a.run_at)?.getTime() ?? 0;
        const db = safeDate(b.run_at)?.getTime() ?? 0;
        return da - db;
      })
      .slice(-30);

    if (tableHistory.length === 0) {
      return (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium">{tableName}</CardTitle>
          </CardHeader>
          <CardContent className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">
            No history
          </CardContent>
        </Card>
      );
    }

    const latest = tableHistory[tableHistory.length - 1];
    const latestScore = latest.score ?? 0;
    const fillValue =
      latestScore > 90 ? '#10b981' : latestScore >= 70 ? '#f59e0b' : '#ef4444';

    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">{tableName}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tableHistory}>
              <XAxis dataKey="run_at" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                labelFormatter={(val) => safeFormat(val as string, 'MMM dd, HH:mm')}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke={fillValue}
                fill={fillValue}
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const historyForSelected = (scores as QualityScoreItem[] | undefined)
    ?.filter(s => s.table_name === selectedTable)
    .sort((a, b) => {
      const da = safeDate(a.run_at)?.getTime() ?? 0;
      const db = safeDate(b.run_at)?.getTime() ?? 0;
      return da - db;
    }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground">
          Monitor the integrity and freshness of your warehouse tables.
        </p>
      </div>

      {loadingAlerts ? null : alerts && (alerts as QualityScoreItem[]).length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failing Checks Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 text-sm">
              {(alerts as QualityScoreItem[]).map((a, idx) => (
                <li key={a.id ?? idx}>
                  {a.table_name}: {a.check_name} failed ({safeScore(a.score)})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500 text-emerald-500 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>All Checks Passing</AlertTitle>
          <AlertDescription>
            Your data warehouse is currently in a healthy state.
          </AlertDescription>
        </Alert>
      )}

      {/* Score Trends — keyed by actual table names from the backend */}
      {!loadingScores && scores && (scores as QualityScoreItem[]).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from(new Set((scores as QualityScoreItem[]).map(s => s.table_name))).map(
            tableName => (
              <div key={tableName}>{renderTrendChart(tableName)}</div>
            )
          )}
        </div>
      )}

      {/* Score Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table Name</TableHead>
              <TableHead>Check</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Last Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingScores ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : tableData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No quality scores recorded yet. Run a pipeline to see quality results.
                </TableCell>
              </TableRow>
            ) : (
              tableData.map((row, idx) => (
                <TableRow
                  key={row.id ?? `${row.table_name}-${row.check_name}-${idx}`}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedTable(row.table_name)}
                >
                  <TableCell className="font-medium">{row.table_name}</TableCell>
                  <TableCell>{row.check_name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {safeScore(row.score)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusVariant(row.passed)}
                      className={getStatusClassName(row.passed)}
                    >
                      {getStatusLabel(row.passed)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {safeFormatDistance(row.run_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={!!selectedTable}
        onOpenChange={(open) => !open && setSelectedTable(null)}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Quality History: {selectedTable}</DialogTitle>
          </DialogHeader>
          <div className="h-[300px] mt-4">
            {historyForSelected.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No history available for this table.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyForSelected}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="run_at"
                    tickFormatter={(v) => safeFormat(v, 'MMM dd')}
                  />
                  <YAxis domain={[0, 100]} />
                  <Tooltip
                    labelFormatter={(val) => safeFormat(val as string, 'MMM dd, HH:mm')}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
