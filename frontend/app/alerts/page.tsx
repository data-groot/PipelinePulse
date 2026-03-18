"use client";

import { usePipelines } from "@/lib/api"; // Reusing for generic data context
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ShieldAlert, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";

export default function AlertsPage() {
  const { data: pipelines } = usePipelines();
  
  // Hardcoded layout for the requested Quality views (mocking real Alerts logic which we might map to quality_runs)
  const alerts = [
    { id: 1, type: "data_quality", severity: "high", table: "silver.stg_orders", check: "not_null(amount)", message: "Found 43 records with null amount", runtime: new Date(Date.now() - 1000 * 60 * 30), status: "open" },
    { id: 2, type: "system_latency", severity: "medium", table: "bronze.raw_commits", check: "SLA_latency", message: "Job execution time exceeded 5m threshold", runtime: new Date(Date.now() - 1000 * 60 * 60 * 2), status: "resolved" },
    { id: 3, type: "schema_drift", severity: "high", table: "bronze.raw_weather", check: "schema_match", message: "New unforeseen column 'gust_speed' detected in payload", runtime: new Date(Date.now() - 1000 * 60 * 60 * 24), status: "open" },
  ];

  return (
    <div className="p-8 space-y-6 animate-in-fade">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Quality Control</h2>
        <p className="text-muted-foreground mt-1">Data incident reporting, SLA breaches, and generic anomalies.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass-card border-white/5 hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive uppercase tracking-wider">Critical Incidents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">2</div>
            <p className="text-xs text-muted-foreground mt-1">Require immediate resolution</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5 hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-500 uppercase tracking-wider">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">1</div>
            <p className="text-xs text-muted-foreground mt-1">SLA or minor validation issues</p>
          </CardContent>
        </Card>
        <Card className="glass-card border-white/5 hover-lift">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-500 uppercase tracking-wider">System Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground mt-1">Data reliability score</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card border-white/5 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50 border-b border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead>Severity</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Target Entity</TableHead>
              <TableHead>Alert Details</TableHead>
              <TableHead className="text-right">Detected</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {alerts.map((alert) => (
              <TableRow key={alert.id} className="border-border/50 transition-colors hover:bg-muted/30 group">
                <TableCell>
                  <Badge variant="outline" className={`font-mono px-2 py-0.5 ${alert.severity === 'high' ? 'status-failed' : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'}`}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {alert.type}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {alert.table}
                  <p className="text-[10px] text-muted-foreground uppercase">{alert.check}</p>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm max-w-xs truncate" title={alert.message}>
                  {alert.message}
                </TableCell>
                <TableCell className="text-right text-muted-foreground text-sm">
                  {formatDistanceToNow(alert.runtime, { addSuffix: true })}
                </TableCell>
                <TableCell className="text-right">
                  {alert.status === "open" ? (
                    <Badge variant="outline" className="text-blue-400 border-blue-400 bg-blue-400/10">Action Required</Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500 bg-emerald-500/10"><CheckCircle2 className="h-3 w-3 mr-1"/>Resolved</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
