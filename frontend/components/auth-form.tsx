'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { login, signup } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await (isSignup ? signup(email, password) : login(email, password));
      router.push(searchParams.get('next') || '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2">
          <div className="bg-primary/20 p-2 rounded-lg ring-1 ring-primary/30">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-xl tracking-tight">PipelinePulse</span>
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>{isSignup ? 'Create your account' : 'Welcome back'}</CardTitle>
            <CardDescription>
              {isSignup
                ? 'Connect a data source and see your first pipeline run in minutes.'
                : 'Log in to your pipeline control room.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={isSignup ? 8 : undefined}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {isSignup ? (
                <>Already have an account? <Link href="/login" className="text-primary hover:underline">Log in</Link></>
              ) : (
                <>New to PipelinePulse? <Link href="/signup" className="text-primary hover:underline">Create an account</Link></>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
