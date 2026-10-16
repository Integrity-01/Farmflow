import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';

export function AdminLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') ?? '/';
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!adminId.trim() || !password) {
      setError('Please enter both your Admin ID and password.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await authApi.adminLogin(adminId.trim(), password);
      useAuthStore.getState().setSession(session.user, session.accessToken);
      navigate(next, { replace: true });
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

  return (
    <AuthLayout
      title="Administrator sign in"
      subtitle="Use the Admin ID issued with your organization."
      footer={
        <>
          Not an administrator?{' '}
          <Link to="/login/welcome" className="font-semibold text-brand-700 hover:underline">
            Back to options
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="danger">
            <AlertTitle>Sign-in failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <FormField id="adminId" label="Admin ID" required>
          <Input
            id="adminId"
            type="text"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="FF-ADM-XXXX-XXXX"
            value={adminId}
            onChange={(event) => setAdminId(event.target.value)}
            className="font-mono tracking-wide"
          />
        </FormField>

        <FormField id="admin-password" label="Password" required>
          <div className="relative">
            <Input
              id="admin-password"
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
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </button>
          </div>
        </FormField>

        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
          Your Admin ID is a private login identifier — never share it or your password with anyone.
        </p>

        <div className="flex items-center justify-between">
          <Link
            to="/login/welcome"
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back
          </Link>
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in as administrator'}
        </Button>
      </form>
    </AuthLayout>
  );
}
