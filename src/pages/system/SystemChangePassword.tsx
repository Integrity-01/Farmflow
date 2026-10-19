import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, ShieldAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { systemAuthApi } from '@/services/system';
import { useSystemAdminStore } from '@/store/systemAdmin.store';

export function SystemChangePassword() {
  const navigate = useNavigate();
  const user = useSystemAdminStore((state) => state.user);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const forced = Boolean(user?.mustChangePassword);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!currentPassword) errors.currentPassword = 'Enter your current password.';
    if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters.';
    if (newPassword && newPassword === currentPassword) {
      errors.newPassword = 'Choose a password different from the current one.';
    }
    if (newPassword !== confirm) errors.confirm = 'Passwords do not match.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await systemAuthApi.changePassword(currentPassword, newPassword);
      useSystemAdminStore.getState().clearSession();
      navigate('/system/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'We could not update your password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>
            Updating your password signs out every active session, including this one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {forced ? (
            <Alert variant="warning" className="mb-5">
              <AlertTitle>Password change required</AlertTitle>
              <AlertDescription>
                You are signed in with a temporary password. Choose a new password to continue.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="danger" className="mb-5">
              <AlertTitle>Update failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField id="sysCurrentPassword" label="Current password" required error={fieldErrors.currentPassword}>
              <Input
                id="sysCurrentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </FormField>
            <FormField id="sysPasswordNew" label="New password" required error={fieldErrors.newPassword}>
              <Input
                id="sysPasswordNew"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </FormField>
            <FormField id="sysPasswordConfirm" label="Confirm new password" required error={fieldErrors.confirm}>
              <Input
                id="sysPasswordConfirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </FormField>

            <div className="flex items-start gap-2 rounded-xl bg-pale p-3 text-xs leading-5 text-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-forest-600" aria-hidden />
              Use a unique password you do not use anywhere else. Platform access is high-value.
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              <KeyRound className="size-4" aria-hidden />
              {submitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
