import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SystemAuthLayout } from '@/components/system/SystemAuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { systemAuthApi } from '@/services/system';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SystemForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!emailPattern.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError(undefined);
    setSubmitting(true);
    try {
      const result = await systemAuthApi.forgotPassword(email.trim());
      setSent(true);
      if (result.devResetLink) setDevLink(result.devResetLink);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SystemAuthLayout
      title="Reset system password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/system/login" className="font-semibold text-accent-400 hover:underline">
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
              If {email.trim()} is registered, a reset link is on its way. The link expires in 30
              minutes.
            </AlertDescription>
          </Alert>
          {devLink ? (
            <Alert variant="info">
              <AlertTitle>Development link</AlertTitle>
              <AlertDescription>
                <span className="break-all font-mono text-xs">{devLink}</span>
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
          <FormField id="sysEmail" label="Email" required error={emailError}>
            <Input
              id="sysEmail"
              type="email"
              autoComplete="email"
              placeholder="you@farm.example"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <Button type="submit" variant="lime" className="w-full" disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </SystemAuthLayout>
  );
}
