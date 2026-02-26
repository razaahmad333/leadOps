import React, { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function LoginPage(): React.JSX.Element {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('owner@local.test');
  const [password, setPassword] = useState('Password123!');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    void navigate(user.role === 'OWNER' ? '/owner/dashboard' : '/staff/today', {
      replace: true,
    });
  }, [navigate, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await login(email, password);
      toast.success('Welcome back to HikmahOne');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden rounded-3xl border bg-card/70 p-10 shadow-lg backdrop-blur lg:block">
          <p className="text-sm uppercase tracking-[0.24em] text-muted-foreground">HikmahOne</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight">
            LeadOps that keeps every follow-up intentional.
          </h1>
          <p className="mt-5 max-w-lg text-base text-muted-foreground">
            Manage your pipeline with disciplined reminders, tenant-safe workflows, and a calm enterprise control room.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-muted-foreground">Queue health</p>
              <p className="mt-1 text-2xl font-semibold">BullMQ + Redis</p>
            </div>
            <div className="rounded-xl border bg-background/60 p-4">
              <p className="text-muted-foreground">Tenant mode</p>
              <p className="mt-1 text-2xl font-semibold">SaaS + Single</p>
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border bg-card/95 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Access HikmahOne LeadOps workspace</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Sign in'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <p className="mt-5 text-xs text-muted-foreground">
              Local dev users: `owner@local.test` / `staff@local.test` with password `Password123!`
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
