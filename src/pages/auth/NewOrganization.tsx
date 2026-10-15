import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Copy, Sprout } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';
import type { AuthSession } from '@/types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewOrganization() {
  const navigate = useNavigate();
  const [organizationName, setOrganizationName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<AuthSession | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (organizationName.trim().length < 2) errors.organizationName = 'Enter an organization name.';
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
      const result = await authApi.createOrganization({
        organizationName: organizationName.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      setAccessKey(result.accessKey);
      setCreatedSession({ user: result.user, accessToken: result.accessToken });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!accessKey) return;
    try {
      await navigator.clipboard.writeText(accessKey);
      setCopied(true);
    } catch {
      setError('Copy was blocked by your browser. Select and copy the key manually.');
    }
  }

  function continueToFarmFlow() {
    if (!createdSession) {
      setError('Your administrator session is unavailable. Please sign in using the organization key.');
      return;
    }
    useAuthStore.getState().setSession(createdSession.user, createdSession.accessToken);
    navigate('/dashboard', { replace: true });
  }

  if (accessKey) {
    return (
      <AuthLayout title="Your organization is ready" subtitle="Save this key somewhere safe. It is shown only once.">
        <div className="space-y-4">
          <Alert variant="success">
            <AlertTitle>{organizationName.trim()}</AlertTitle>
            <AlertDescription>
              You are signed in as the organization administrator. Share this key only with people
              who should be able to join your organization.
            </AlertDescription>
          </Alert>
          <FormField id="new-access-key" label="Organization key">
            <Input id="new-access-key" value={accessKey} readOnly onFocus={(event) => event.currentTarget.select()} />
          </FormField>
          <Button type="button" variant="secondary" className="w-full" onClick={() => void copyKey()}>
            {copied ? <Check className="mr-2 size-4" aria-hidden /> : <Copy className="mr-2 size-4" aria-hidden />}
            {copied ? 'Copied' : 'Copy organization key'}
          </Button>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button
            type="button"
            className="w-full"
            onClick={continueToFarmFlow}
          >
            Continue to FarmFlow
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create an organization"
      subtitle="Set up your team and become its first administrator."
      footer={
        <>
          Already have an organization key?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Enter it here
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert variant="danger">
            <AlertTitle>Organization setup failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <FormField id="organizationName" label="Organization name" required error={fieldErrors.organizationName}>
          <Input id="organizationName" autoComplete="organization" placeholder="e.g. Green Valley Farms" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} />
        </FormField>
        <div className="border-t border-slate-100 pt-1">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Sprout className="size-4 text-brand-700" aria-hidden />
            Administrator account
          </p>
          <div className="space-y-4">
            <FormField id="name" label="Full name" required error={fieldErrors.name}>
              <Input id="name" autoComplete="name" placeholder="e.g. Amara Okafor" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField id="email" label="Email" required error={fieldErrors.email}>
              <Input id="email" type="email" autoComplete="email" placeholder="you@farm.example" value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormField>
            <FormField id="phone" label="Phone" hint="Optional">
              <Input id="phone" type="tel" autoComplete="tel" placeholder="+234 800 000 0000" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField id="password" label="Password" required error={fieldErrors.password}>
              <Input id="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} />
            </FormField>
            <FormField id="confirm" label="Confirm password" required error={fieldErrors.confirm}>
              <Input id="confirm" type="password" autoComplete="new-password" placeholder="Repeat your password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </FormField>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating organization…' : 'Create organization and admin'}
        </Button>
      </form>
    </AuthLayout>
  );
}
