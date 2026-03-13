import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import type { PublicTenantBranding, TenantLoginBranding } from '@leadops/shared';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PasswordInput } from '../components/ui/password-input';

const DEFAULT_LOGIN_BRANDING: TenantLoginBranding = {
  eyebrow: 'HikmahOne',
  headline: 'Run your diagnostic lab with faster follow-ups and fewer missed patients.',
  subheadline:
    'Track patient enquiries, booking intent, report delivery, and post-report follow-ups in one focused workspace built for lab operations.',
  highlightOneLabel: 'Booking pipeline',
  highlightOneText: 'See every enquiry in motion',
  highlightTwoLabel: 'Report follow-through',
  highlightTwoText: 'Reduce missed post-report calls',
  calloutTitle: 'Built for diagnostics teams',
  calloutText: 'Give reception, operations, and lab owners a clear view of what needs action across bookings and follow-ups.',
};

function resolveApiOrigin(): string {
  const configured = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  if (!configured) {
    return window.location.origin;
  }

  try {
    return new URL(configured, window.location.origin).origin;
  } catch {
    return configured;
  }
}

export function LoginPage(): React.JSX.Element {
  const {
    user,
    login,
    loginWithOtp,
    requestLoginOtp,
    pendingTenantSelection,
    clearPendingTenantSelection,
    selectTenant,
    defaultRoute,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDevHints = import.meta.env.DEV;
  const tenantSlug = searchParams.get('tenant')?.trim().toLowerCase() ?? '';

  const [identifier, setIdentifier] = useState(showDevHints ? 'owner@local.test' : '');
  const [password, setPassword] = useState(showDevHints ? 'Password123!' : '');
  const [otpPhone, setOtpPhone] = useState(showDevHints ? '+1-555-0101' : '');
  const [otpCode, setOtpCode] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [submitting, setSubmitting] = useState(false);
  const [publicBranding, setPublicBranding] = useState<PublicTenantBranding | null>(null);

  const activeBranding = useMemo(
    () => publicBranding?.branding ?? DEFAULT_LOGIN_BRANDING,
    [publicBranding],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    void navigate(defaultRoute, {
      replace: true,
    });
  }, [defaultRoute, navigate, user]);

  useEffect(() => {
    if (!tenantSlug) {
      setPublicBranding(null);
      return;
    }

    if (!/^[a-z0-9-]{2,120}$/.test(tenantSlug)) {
      setPublicBranding(null);
      return;
    }

    const controller = new AbortController();
    const origin = resolveApiOrigin();

    void fetch(`${origin}/v1/public/tenant-branding?tenant=${encodeURIComponent(tenantSlug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
          return null;
        }

        return (await response.json()) as PublicTenantBranding;
      })
      .then((payload) => {
        setPublicBranding(payload);
      })
      .catch(() => {
        setPublicBranding(null);
      });

    return () => {
      controller.abort();
    };
  }, [tenantSlug]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const challenge = await login(identifier, password);
      if (challenge) {
        toast.success('Choose a tenant to continue');
      } else {
        toast.success('Welcome back to HikmahOne');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async (): Promise<void> => {
    setSubmitting(true);

    try {
      const response = await requestLoginOtp(otpPhone);
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
      const challenge = await loginWithOtp(otpPhone, verificationId, otpCode);
      if (challenge) {
        toast.success('Choose a tenant to continue');
      } else {
        toast.success('Logged in with OTP');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'OTP verification failed');
    } finally {
      setSubmitting(false);
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

  const chooseTenant = async (tenantId: string): Promise<void> => {
    if (!pendingTenantSelection) {
      return;
    }

    setSubmitting(true);

    try {
      await selectTenant(pendingTenantSelection.selectionToken, tenantId);
      toast.success('Tenant selected');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to select tenant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(20,184,166,0.14),transparent_32%)]" />
      <div className="relative grid w-full max-w-6xl gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-white/80 bg-card/80 p-6 shadow-[0_30px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8 lg:p-10">
          {activeBranding.logoUrl ? (
            <img
              src={activeBranding.logoUrl}
              alt={activeBranding.logoAlt ?? `${publicBranding?.tenantName ?? 'Tenant'} logo`}
              className="h-12 w-auto max-w-[220px] object-contain"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{activeBranding.eyebrow}</p>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            {activeBranding.headline}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            {activeBranding.subheadline}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-2xl border border-white/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{activeBranding.highlightOneLabel}</p>
              <p className="mt-2 text-xl font-semibold sm:text-2xl">{activeBranding.highlightOneText}</p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{activeBranding.highlightTwoLabel}</p>
              <p className="mt-2 text-xl font-semibold sm:text-2xl">{activeBranding.highlightTwoText}</p>
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-white/70 bg-slate-950/[0.03] p-4 sm:p-5">
            <p className="text-sm font-semibold">{activeBranding.calloutTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {activeBranding.calloutText}
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

            {pendingTenantSelection ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
                  <p className="text-sm font-semibold">Choose a tenant</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This account has access to more than one workspace.
                  </p>
                </div>

                <div className="space-y-2">
                  {pendingTenantSelection.tenants.map((tenant) => (
                    <Button
                      key={tenant.tenantId}
                      type="button"
                      variant="outline"
                      className="flex h-auto w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                      disabled={submitting}
                      onClick={() => void chooseTenant(tenant.tenantId)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{tenant.tenantName}</span>
                        <span className="block truncate text-xs text-muted-foreground">{tenant.tenantSlug}</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Button>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={submitting}
                  onClick={clearPendingTenantSelection}
                >
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={mode === 'password' ? (event) => void onSubmit(event) : onOtpSubmit}
              >
                <div className="space-y-2">
                  <Label htmlFor="login-identifier">
                    {mode === 'password' ? 'Email or Mobile Number' : 'Mobile Number'}
                  </Label>
                  <Input
                    id="login-identifier"
                    type={mode === 'password' ? 'text' : 'tel'}
                    autoComplete={mode === 'password' ? 'username' : 'tel'}
                    placeholder={mode === 'password' ? 'name@company.com or +1-555-0101' : '+1-555-0101'}
                    value={mode === 'password' ? identifier : otpPhone}
                    onChange={(event) => {
                      if (mode === 'password') {
                        setIdentifier(event.target.value);
                        return;
                      }

                      setOtpPhone(event.target.value);
                      setVerificationId(null);
                      setOtpCode('');
                    }}
                    required
                  />
                </div>

                {mode === 'password' ? (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <PasswordInput
                      id="password"
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
            )}

            {showDevHints ? (
              <div className="mt-5 rounded-2xl border border-white/70 bg-secondary/30 p-4 text-xs text-muted-foreground">
                <p>Super Admin: `admin@local.test` or `+1-555-0001`</p>
                <p>Shared Owner: `owner@local.test` or `+1-555-0101`</p>
                <p>Shared Staff: `staff@local.test` or `+1-555-0102`</p>
                <p>Password for all users: `Password123!`</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
