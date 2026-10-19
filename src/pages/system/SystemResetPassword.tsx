import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SystemAuthLayout } from '@/components/system/SystemAuthLayout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { systemAuthApi } from '@/services/system';

export function SystemResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!token) errors.token = 'The reset link is invalid.';
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
      await systemAuthApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SystemAuthLayout title="Choose a new password" subtitle="Pick a strong password for your platform account.">
      {done ? (
        <div className="space-y-4">
          <Alert variant="success">
            <AlertTitle>Password updated</AlertTitle>
            <AlertDescription>Your password was reset and all sessions were signed out.</AlertDescription>
          </Alert>
          <Button asChild variant="lime" className="w-full">
            <Link to="/system/login">Sign in with your new password</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error ? (
            <Alert variant="danger">
              <AlertTitle>Reset failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!token && !fieldErrors.token ? (
            <Alert variant="warning">
              <AlertTitle>Missing link</AlertTitle>
              <AlertDescription>Open the link from the password reset email.</AlertDescription>
            </Alert>
          ) : null}
          <FormField id="sysNewPassword" label="New password" required error={fieldErrors.password}>
            <Input
              id="sysNewPassword"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
          <FormField id="sysConfirmPassword" label="Confirm new password" required error={fieldErrors.confirm}>
            <Input
              id="sysConfirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </FormField>
          <Button type="submit" variant="lime" className="w-full" disabled={submitting || !token}>
            {submitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      )}
    </SystemAuthLayout>
  );
}
