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
  const { user, login, loginWithOtp, requestLoginOtp, defaultRoute } = useAuth();
  const navigate = useNavigate();
  const showDevHints = import.meta.env.DEV;

  const [phone, setPhone] = useState('+1-555-0101');
  const [password, setPassword] = useState('Password123!');
  const [otpCode, setOtpCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }

    void navigate(defaultRoute, {
      replace: true,
    });
  }, [defaultRoute, navigate, user]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await login(phone, password);
      toast.success('Welcome back to HikmahOne');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async (): Promise<void> => {
    setSubmitting(true);

    try {
      const response = await requestLoginOtp(phone);
      setVerificationId(response.verificationId);
      if (response.devOtpCode) {
        setOtpCode(response.devOtpCode);
      }
      toast.success('OTP sent to your mobile number');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to send OTP');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async (): Promise<void> => {
    if (!verificationId) {
      return;
    }

    setSubmitting(true);

    try {
      await loginWithOtp(phone, verificationId, otpCode);
      toast.success('Logged in with OTP');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OTP verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const onPhoneChange = (value: string): void => {
    setPhone(value);
    if (mode === 'otp') {
      setVerificationId(null);
      setOtpCode('');
    }
  };

  const onOtpSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (verificationId) {
      void verifyOtp();
      return;
    }

    void requestOtp();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_32%)]" />
      <div className="relative grid w-full max-w-6xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/80 bg-card/80 p-6 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8 lg:p-10">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">HikmahOne</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Run your diagnostic lab with faster follow-ups and fewer missed patients.
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Track patient enquiries, booking intent, report delivery, and post-report follow-ups in one focused workspace built for lab operations.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-2xl border border-white/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Booking pipeline</p>
              <p className="mt-2 text-xl font-semibold sm:text-2xl">See every enquiry in motion</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Report follow-through</p>
              <p className="mt-2 text-xl font-semibold sm:text-2xl">Reduce missed post-report calls</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/70 bg-slate-950/[0.03] p-4 sm:p-5">
            <p className="text-sm font-semibold">Built for diagnostics teams</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Give reception, operations, and lab owners a clear view of what needs action across bookings and follow-ups.
            </p>
          </div>
        </div>

        <Card className="rounded-[2rem] border border-white/80 bg-card/95 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.5)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              {mode === 'password' ? 'Access your diagnostic lab workspace' : 'Forgot your password? Use OTP login'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2 rounded-2xl border border-white/70 bg-secondary/30 p-1">
              <button
                type="button"
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'password' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => {
                  setMode('password');
                  setVerificationId(null);
                  setOtpCode('');
                }}
              >
                Password
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'otp' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => {
                  setMode('otp');
                  setPassword('');
                }}
              >
                Forgot Password
              </button>
            </div>

            <form
              className="space-y-5"
              onSubmit={mode === 'password' ? (event) => void onSubmit(event) : onOtpSubmit}
            >
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => onPhoneChange(event.target.value)}
                  required
                />
              </div>

              {mode === 'password' ? (
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
              ) : verificationId ? (
                <div className="space-y-2">
                  <Label htmlFor="otp">OTP Code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                    placeholder="Enter the SMS code"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the OTP sent to your mobile number. Request a new code if this one expires.
                  </p>
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? mode === 'password'
                    ? 'Signing in...'
                    : verificationId
                      ? 'Verifying OTP...'
                      : 'Sending OTP...'
                  : mode === 'password'
                    ? 'Sign in'
                    : verificationId
                      ? 'Verify OTP & Sign in'
                      : 'Send OTP'}
                <ArrowRight className="h-4 w-4" />
              </Button>

              {mode === 'otp' && verificationId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={submitting}
                  onClick={() => void requestOtp()}
                >
                  Resend OTP
                </Button>
              ) : null}
            </form>

            {showDevHints ? (
              <div className="mt-5 rounded-2xl border border-white/70 bg-secondary/30 p-4 text-xs text-muted-foreground">
                <p>Super Admin: `+1-555-0001`</p>
                <p>Demo Owner: `+1-555-0101`</p>
                <p>Demo Staff: `+1-555-0102`</p>
                <p>Password for all users: `Password123!`</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
