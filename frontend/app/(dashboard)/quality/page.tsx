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

  const latestScores = new Map();
  if (scores) {
    [...scores]
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .forEach(s => {
        const key = `${s.table_name}-${s.check_name}`;
        latestScores.set(key, s);
      });
  }
  
  const tableData = Array.from(latestScores.values()).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'failed' ? -1 : 1;
    return a.table_name.localeCompare(b.table_name);
  });

  const getLayerColor = (layer: string) => {
    const l = layer?.toLowerCase();
    if (l === 'bronze') return 'bg-amber-700 hover:bg-amber-800 text-white';
    if (l === 'silver') return 'bg-slate-400 hover:bg-slate-500 text-white';
    if (l === 'gold') return 'bg-yellow-500 hover:bg-yellow-600 text-white';
    return 'bg-gray-500 text-white';
  };

  const getStatusColor = (status: string) => status === 'failed' ? 'destructive' : 'default';

  const renderTrendChart = (tableName: string) => {
    if (!scores) return null;
    const tableHistory = scores
      .filter((s: any) => s.table_name === tableName)
      .sort((a: any, b: any) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
      .slice(-30);

    if (tableHistory.length === 0) return (
        <Card>
            <CardHeader className="p-4 pb-2"><CardTitle className="text-sm font-medium">{tableName}</CardTitle></CardHeader>
            <CardContent className="h-[100px] flex items-center justify-center text-sm text-muted-foreground">No history</CardContent>
        </Card>
    );

    const latest = tableHistory[tableHistory.length - 1];
    const fillValue = latest.score > 90 ? '#10b981' : latest.score >= 70 ? '#f59e0b' : '#ef4444';

    return (
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-medium">{tableName}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tableHistory}>
              <XAxis dataKey="measured_at" hide />
              <YAxis domain={[0, 100]} hide />
              <Tooltip labelFormatter={(val) => format(new Date(val), 'MMM dd, HH:mm')} />
              <Area type="monotone" dataKey="score" stroke={fillValue} fill={fillValue} fillOpacity={0.2} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  const historyForSelected = scores?.filter((s: any) => s.table_name === selectedTable)
    .sort((a: any, b: any) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Quality</h1>
        <p className="text-muted-foreground">Monitor the integrity and freshness of your warehouse tables.</p>
      </div>

      {loadingAlerts ? null : alerts && alerts.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failing Checks Detected</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 text-sm">
              {alerts.map((a: any) => (
                <li key={a.id}>{a.table_name}: {a.check_name} failed ({a.score.toFixed(1)}%)</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-emerald-500 text-emerald-500 bg-emerald-500/10">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle>All Checks Passing</AlertTitle>
          <AlertDescription>Your data warehouse is currently in a healthy state.</AlertDescription>
        </Alert>
      )}

      {/* Score Trends Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderTrendChart('stg_weather_forecasts')}
        {renderTrendChart('stg_customer_orders')}
        {renderTrendChart('stg_github_commits')}
      </div>

      {/* Score Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table Name</TableHead>
              <TableHead>Layer</TableHead>
              <TableHead>Check</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Last Checked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingScores ? (
              <TableRow><TableCell colSpan={6} className="text-center">Loading...</TableCell></TableRow>
            ) : tableData.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No quality scores recorded.</TableCell></TableRow>
            ) : (
              tableData.map((row) => (
                <TableRow key={row.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedTable(row.table_name)}>
                  <TableCell className="font-medium">{row.table_name}</TableCell>
                  <TableCell>
                    <Badge className={getLayerColor(row.schema_layer)}>{row.schema_layer || 'Unknown'}</Badge>
                  </TableCell>
                  <TableCell>{row.check_name}</TableCell>
                  <TableCell className="text-right font-mono">{row.score.toFixed(1)}%</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(row.status)} className={row.status === 'passed' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(row.measured_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedTable} onOpenChange={(open) => !open && setSelectedTable(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Quality History: {selectedTable}</DialogTitle>
          </DialogHeader>
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historyForSelected}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="measured_at" tickFormatter={(v) => format(new Date(v), 'MMM dd')} />
                <YAxis domain={[0, 100]} />
                <Tooltip labelFormatter={(val) => format(new Date(val), 'MMM dd, HH:mm')} />
                <Area type="monotone" dataKey="score" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
