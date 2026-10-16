import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi } from '@/services/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSent(false);
    setDevLink(null);

    if (!emailPattern.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(undefined);

    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword(email.trim());
      setSent(true);
      if (result.devResetLink) {
        setDevLink(result.devResetLink);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login/welcome" className="font-semibold text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert variant="success">
            <AlertTitle>Check your inbox</AlertTitle>
            <AlertDescription>
              If {email.trim()} is registered, a reset link is on its way. The link
              expires in 30 minutes.
            </AlertDescription>
          </Alert>
          {devLink ? (
            <Alert variant="info">
              <AlertTitle>Development link</AlertTitle>
              <AlertDescription>
                No email provider is configured, so here's the link for local
                testing: <span className="break-all font-mono text-xs">{devLink}</span>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <FormField id="email" label="Email" required error={emailError}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@farm.example"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}