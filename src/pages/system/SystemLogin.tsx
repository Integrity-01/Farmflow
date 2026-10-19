import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { systemAuthApi } from '@/services/system';
import { useSystemAdminStore } from '@/store/systemAdmin.store';
import { formatSystemAdminId } from '@/utils/systemAdminId';
import type { SystemAdminAuthUser } from '@/types/system';

type Step = 'credentials' | 'mfa';

export function SystemLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/system/overview';

  const [step, setStep] = useState<Step>('credentials');
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function completeSession(user: SystemAdminAuthUser, accessToken: string) {
    useSystemAdminStore.getState().setSession(user, accessToken);
    navigate(next, { replace: true });
  }

  async function handleCredentials(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!adminId.trim() || !password) {
      setError('Please enter both your System Administrator ID and password.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await systemAuthApi.login(adminId.trim(), password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        setStep('mfa');
        return;
      }
      if (result.user && result.accessToken) {
        completeSession(result.user, result.accessToken);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'We could not sign you in. Please check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMfa(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setSubmitting(true);
    try {
      const session = await systemAuthApi.verifyMfa(mfaToken, code.trim());
      completeSession(session.user, session.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verification failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-forest-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-400 text-forest-950 shadow-glass">
            <ShieldCheck className="size-8" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">FarmFlow System</h1>
          <p className="mt-1 text-sm text-forest-100/70">Central administration sign in</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-lift">
          {error ? (
            <Alert variant="danger" className="mb-5">
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {step === 'credentials' ? (
            <form onSubmit={handleCredentials} className="space-y-4" noValidate>
              <FormField id="sysAdminId" label="System Administrator ID" required>
                <Input
                  id="sysAdminId"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="FF-SYS-XXXX-XXXX"
                  value={adminId}
                  onChange={(event) => setAdminId(formatSystemAdminId(event.target.value))}
                  className="font-mono tracking-wide"
                />
              </FormField>

              <FormField id="sysPassword" label="Password" required>
                <div className="relative">
                  <Input
                    id="sysPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                  </button>
                </div>
              </FormField>

              <div className="flex justify-end">
                <Link to="/system/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
                  Forgot password?
                </Link>
              </div>

              <Button type="submit" variant="lime" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4" noValidate>
              <div className="flex items-start gap-3 rounded-xl bg-pale p-3 text-xs leading-5 text-muted">
                <KeyRound className="mt-0.5 size-4 shrink-0 text-forest-600" aria-hidden />
                Enter the 6-digit code from your authenticator app to finish signing in.
              </div>

              <FormField id="sysMfaCode" label="Verification code" required>
                <Input
                  id="sysMfaCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
              </FormField>

              <Button type="submit" variant="lime" className="w-full" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify & continue'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('credentials');
                  setCode('');
                  setError(null);
                }}
              >
                Back
              </Button>
            </form>
          )}

          <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-forest-600" aria-hidden />
            This is a restricted platform area. Access is logged and monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
