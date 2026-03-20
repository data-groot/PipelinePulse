"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchToken } from "@/lib/api";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();
  const loginMutation = useMutation({
    mutationFn: ({ username, password }: any) => fetchToken(username, password),
    onSuccess: (data) => {
       if (typeof window !== 'undefined') {
         localStorage.setItem('token', data.access_token);
       }
    }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      toast.success("Successfully logged in");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden">
      {/* Dynamic Background Effects */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[150px] -z-10" />

      <div className="glass-card w-full max-w-md p-8 rounded-2xl animate-in-slide relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-primary/10 p-4 rounded-full mb-4 ring-1 ring-primary/20 hover-lift">
            <Activity className="h-10 w-10 text-primary animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-glow">PipelinePulse</h1>
          <p className="text-muted-foreground mt-2 text-center text-sm">
            Real-time ETL Observability Platform
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-background/50 border-white/10 focus:ring-primary/50 transition-all shadow-inner"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-background/50 border-white/10 focus:ring-primary/50 transition-all shadow-inner"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full hover-lift bg-primary text-primary-foreground shadow-[0_0_20px_rgba(var(--primary),0.3)] transition-all"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Authenticating..." : "Sign In"}
          </Button>
          
          <div className="text-center text-sm text-muted-foreground/80 pt-4">
            <p>Demo Credentials</p>
            <p className="font-mono mt-1 text-foreground/80">admin / admin123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
