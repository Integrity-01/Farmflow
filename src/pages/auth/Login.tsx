import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi, type VerifiedOrganizationState } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/store/toast.store';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const orgState = location.state as VerifiedOrganizationState | null;
  const next = searchParams.get('next') ?? orgState?.next ?? '/';
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!orgState || !orgState.organization?.id || !orgState.accessKey) {
    return <Navigate to="/login/user" replace />;
  }
  const verifiedOrg = orgState;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const session = await authApi.login(
        email.trim(),
        password,
        verifiedOrg.organization.id,
        verifiedOrg.accessKey,
      );
      useAuthStore.getState().setSession(session.user, session.accessToken);
      const firstName = session.user.name.trim().split(/\s+/)[0] || 'there';
      toast({
        variant: 'success',
        title: 'Signed in',
        description: `Welcome back, ${firstName}.`,
      });
      navigate(next, { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
      toast({
        variant: 'danger',
        title: 'Sign-in failed',
        description: message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle={`Sign in to ${verifiedOrg.organization.name}.`}
      footer={
        <>
          New to {verifiedOrg.organization.name}?{' '}
          <Link to="/register" state={verifiedOrg} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
          <span className="mx-2 text-slate-300">·</span>
          <Link to="/login/user" className="font-semibold text-slate-600 hover:underline">
            Change key
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

        <FormField id="email" label="Email" required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@farm.example"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField id="password" label="Password" required>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>

        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  );
}