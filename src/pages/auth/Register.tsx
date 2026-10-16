import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi, type VerifiedOrganizationState } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const orgState = location.state as VerifiedOrganizationState | null;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!orgState || !orgState.organization?.id || !orgState.accessKey) {
    return <Navigate to="/login/user" replace />;
  }
  const verifiedOrg = orgState;

  function validate(): boolean {
    const errors: Record<string, string> = {};

    if (name.trim().length < 2) errors.name = 'Please enter your full name.';
    if (!emailPattern.test(email.trim())) errors.email = 'Please enter a valid email address.';
    if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (password !== confirm) errors.confirm = 'Passwords do not match.';

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      const session = await authApi.register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        organizationId: verifiedOrg.organization.id,
        accessKey: verifiedOrg.accessKey,
      });
      useAuthStore.getState().setSession(session.user, session.accessToken);
      navigate(verifiedOrg.next ?? '/', { replace: true });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle={`Join ${verifiedOrg.organization.name} on FarmFlow.`}
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login/account" state={verifiedOrg} className="font-semibold text-brand-700 hover:underline">
            Sign in
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
            <AlertTitle>Sign-up failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {verifiedOrg.organization.joinMode === 'approval' ? (
          <Alert variant="warning">
            <AlertTitle>Approval required</AlertTitle>
            <AlertDescription>
              After you create your account, an administrator of {verifiedOrg.organization.name}{' '}
              must approve it before you can access farm data.
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField id="name" label="Full name" required error={fieldErrors.name}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="e.g. Amara Okafor"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField id="email" label="Email" required error={fieldErrors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@farm.example"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>

        <FormField id="phone" label="Phone" hint="Optional — used for SMS reminders later.">
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            placeholder="+234 800 000 0000"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </FormField>

        <FormField id="password" label="Password" required error={fieldErrors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>

        <FormField id="confirm" label="Confirm password" required error={fieldErrors.confirm}>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}