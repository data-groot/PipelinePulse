"use client";

import { RunTable } from "@/components/pipeline/run-table";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity } from "lucide-react";

export default function RunsPage() {
  return (
    <div className="p-8 space-y-6 animate-in-slide">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Execution History</h2>
        <p className="text-muted-foreground mt-1">
          Global view of all pipeline trigger iterations, statuses, and performance logs.
        </p>
      </div>

      <Card className="glass-card border-white/5 border-t-primary/20">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Latest Runs
            </CardTitle>
            <CardDescription>Live streaming from Airflow engine</CardDescription>
          </div>
          {/* We can add filter dropdowns here in the future for DAG, Status, etc. */}
        </CardHeader>
        <div className="px-6 pb-6">
          <RunTable limit={50} />
        </div>
      </Card>
    </div>
  );
}
