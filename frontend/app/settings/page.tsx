"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Settings2, Key, BellRing, Database } from "lucide-react";

export default function SettingsPage() {
  const save = () => {
    toast.success("Preferences updated successfully");
  };

  return (
    <div className="p-8 max-w-4xl space-y-8 animate-in-slide">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground mt-1">Manage global platform configurations, API integrations, and notification channels.</p>
      </div>

      <div className="grid gap-6">
        <Card className="glass-card border-white/5 text-card-foreground">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-xl text-primary ring-1 ring-primary/20">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>API Tokens</CardTitle>
              <CardDescription>Secure tokens for external orchestrator integration (Airflow, dbt Cloud).</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t border-border/50">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">OpenWeatherMap API</Label>
              <Input type="password" value="********************************" readOnly className="col-span-3 bg-background/50 border-white/5 font-mono" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">GitHub PAT</Label>
              <Input type="password" value="ghp_****************************" readOnly className="col-span-3 bg-background/50 border-white/5 font-mono" />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t border-border/50 p-4">
             <Button variant="outline" className="border-border/50 text-foreground hover:bg-background" onClick={() => toast.info("Contact admin to rotate API tokens.")}>Rotate Keys</Button>
          </CardFooter>
        </Card>

        <Card className="glass-card border-white/5 text-card-foreground">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 ring-1 ring-blue-500/20">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Data Warehouse Strategy</CardTitle>
              <CardDescription>Configuration for the internal metadata PostgreSQL registry.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t border-border/50">
             <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Database URL</Label>
              <Input type="text" value="postgresql+asyncpg://postgres:postgres@postgres:5432/pipelinepulse" readOnly className="col-span-3 bg-background/50 border-white/5 font-mono text-xs" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Log Retention</Label>
              <select className="col-span-1 flex h-10 w-full rounded-md border border-white/5 bg-background/50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
              </select>
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t border-border/50 p-4 justify-between">
             <p className="text-xs text-muted-foreground">Changes to database connections require system restart.</p>
             <Button onClick={save} className="bg-primary hover:bg-primary/90 hover-lift shadow-[0_0_15px_rgba(var(--primary),0.3)]">Save Changes</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
