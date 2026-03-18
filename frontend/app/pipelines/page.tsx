"use client";

import { usePipelines, useTogglePipeline } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Clock, Box, PlayCircle, ListTree, MoreVertical } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

import { useRouter } from "next/navigation";

export default function PipelinesPage() {
  const router = useRouter();
  const { data: pipelines, isLoading } = usePipelines();
  const toggleMutation = useTogglePipeline();

  const handleToggle = (id: number) => {
    toggleMutation.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Pipelines</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 rounded-xl bg-muted/20" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in-fade">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ListTree className="h-8 w-8 text-primary" />
            Pipelines
          </h2>
          <p className="text-muted-foreground mt-1">Manage data ingestion flows, schedules, and configurations.</p>
        </div>
        <Button className="bg-primary hover:bg-primary/90 text-primary-foreground hover-lift">
          <Activity className="h-4 w-4 mr-2" /> Connect Source
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {pipelines?.map((pipe: any) => (
          <Card key={pipe.id} className="glass-card hover:-translate-y-1 transition-all duration-300 border-white/5 relative overflow-hidden group">
            {/* Themed Glow based on enabled status */}
            <div className={`absolute -inset-1 opacity-20 blur-xl transition-opacity ${pipe.enabled ? "bg-primary group-hover:opacity-40" : "bg-muted group-hover:opacity-30"}`} />
            
            <CardHeader className="relative z-10 flex flex-row items-start justify-between">
              <div>
                <CardTitle className="text-xl">{pipe.name}</CardTitle>
                <CardDescription className="font-mono mt-1 flex items-center gap-1.5">
                  <Box className="h-3 w-3" />
                  {pipe.source_type}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Switch 
                  checked={pipe.enabled} 
                  onCheckedChange={() => handleToggle(pipe.id)}
                  className="data-[state=checked]:bg-primary"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 -m-2 opacity-50 hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="relative z-10 space-y-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-white/5">
                <Clock className="h-4 w-4" />
                Schedule: <span className="text-foreground font-mono">{pipe.schedule}</span>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    {pipe.enabled && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-3 w-3 ${pipe.enabled ? "bg-emerald-500" : "bg-muted-foreground"}`}></span>
                  </span>
                  <span className="text-sm font-medium">{pipe.enabled ? "Active" : "Paused"}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/pipelines/${pipe.id}`)} className="hover-lift bg-secondary/50 hover:bg-secondary border border-white/5">
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
