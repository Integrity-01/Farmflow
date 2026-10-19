import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Lock, Mail, ShieldCheck, ShieldOff, User as UserIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/store/toast.store';
import { systemAuthApi } from '@/services/system';
import { useSystemAdminStore } from '@/store/systemAdmin.store';
import { ApiError } from '@/services/api';
import type { MfaEnrollment } from '@/types/system';

export function SystemSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const user = useSystemAdminStore((state) => state.user);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [mfaDialog, setMfaDialog] = useState<MfaEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  async function handleProfile(event: FormEvent) {
    event.preventDefault();
    setProfileError(null);
    if (name.trim().length < 2) {
      setProfileError('Please enter a full name.');
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await systemAuthApi.updateProfile(name.trim(), email.trim());
      useSystemAdminStore.getState().setUser(updated);
      toast({ title: 'Profile updated', variant: 'success' });
    } catch (error) {
      setProfileError(error instanceof ApiError ? error.message : 'We could not save your profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function startEnrollment() {
    setMfaError(null);
    setMfaBusy(true);
    try {
      const enrollment = await systemAuthApi.beginMfaEnrollment();
      setMfaDialog(enrollment);
      setMfaCode('');
    } catch (error) {
      setMfaError(error instanceof ApiError ? error.message : 'We could not start enrollment.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function confirmEnrollment(event: FormEvent) {
    event.preventDefault();
    setMfaError(null);
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaError('Enter the 6-digit code.');
      return;
    }
    setMfaBusy(true);
    try {
      await systemAuthApi.confirmMfaEnrollment(mfaCode.trim());
      setMfaDialog(null);
      const fresh = await systemAuthApi.me();
      useSystemAdminStore.getState().setUser(fresh);
      toast({ title: 'Two-factor authentication enabled', variant: 'success' });
    } catch (error) {
      setMfaError(error instanceof ApiError ? error.message : 'That code was not accepted.');
    } finally {
      setMfaBusy(false);
    }
  }

  async function disableMfa(event: FormEvent) {
    event.preventDefault();
    setMfaError(null);
    setMfaBusy(true);
    try {
      await systemAuthApi.disableMfa(disablePassword);
      const fresh = await systemAuthApi.me();
      useSystemAdminStore.getState().setUser(fresh);
      setDisablePassword('');
      toast({ title: 'Two-factor authentication disabled', variant: 'success' });
    } catch (error) {
      setMfaError(error instanceof ApiError ? error.message : 'We could not disable MFA.');
    } finally {
      setMfaBusy(false);
    }
  }

  function logoutAll() {
    void systemAuthApi
      .logout()
      .catch(() => undefined)
      .finally(() => {
        useSystemAdminStore.getState().clearSession();
        navigate('/system/login', { replace: true });
      });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <UserIcon className="size-5 text-forest-600" aria-hidden />
            Profile
          </CardTitle>
          <CardDescription>Your identity as a system administrator.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfile} className="space-y-4" noValidate>
            {profileError ? (
              <Alert variant="danger">
                <AlertTitle>Update failed</AlertTitle>
                <AlertDescription>{profileError}</AlertDescription>
              </Alert>
            ) : null}
            <FormField id="sysProfileName" label="Full name" required>
              <Input id="sysProfileName" value={name} onChange={(event) => setName(event.target.value)} />
            </FormField>
            <FormField id="sysProfileEmail" label="Email" hint="Used for password recovery.">
              <Input id="sysProfileEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@farmflow.test" />
            </FormField>
            <div className="rounded-xl bg-pale p-3 text-xs leading-5 text-muted">
              Administrator ID: <span className="font-mono font-semibold text-ink">{user?.adminId}</span> ·{' '}
              {user?.isOwner ? 'System Owner' : 'System Administrator'}
            </div>
            <Button type="submit" loading={savingProfile} disabled={savingProfile}>
              <Mail className="size-4" aria-hidden />
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Lock className="size-5 text-forest-600" aria-hidden />
            Security
          </CardTitle>
          <CardDescription>Manage your password and two-factor authentication.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Password</p>
              <p className="text-xs text-muted">Changing it signs out all sessions.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/system/change-password')}>
              <KeyRound className="size-4" aria-hidden />
              Change
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-hairline p-4">
            <div>
              <p className="text-sm font-semibold text-ink">Two-factor authentication</p>
              <p className="text-xs text-muted">
                {user?.mfaEnabled ? 'Enabled — codes required at sign-in.' : 'Add a TOTP authenticator for extra protection.'}
              </p>
            </div>
            <Badge enabled={Boolean(user?.mfaEnabled)} />
          </div>

          {user?.mfaEnabled ? (
            <form onSubmit={disableMfa} className="space-y-3 rounded-xl bg-pale p-4">
              {mfaError ? <p className="text-sm text-red-600">{mfaError}</p> : null}
              <FormField id="sysDisableMfa" label="Confirm password" required>
                <Input
                  id="sysDisableMfa"
                  type="password"
                  value={disablePassword}
                  onChange={(event) => setDisablePassword(event.target.value)}
                  placeholder="Your password"
                />
              </FormField>
              <Button type="submit" variant="outline" size="sm" loading={mfaBusy} disabled={!disablePassword || mfaBusy}>
                <ShieldOff className="size-4" aria-hidden />
                Disable 2FA
              </Button>
            </form>
          ) : (
            <Button variant="secondary" loading={mfaBusy} disabled={mfaBusy} onClick={() => void startEnrollment()}>
              <ShieldCheck className="size-4" aria-hidden />
              Enable 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <ShieldOff className="size-5 text-forest-600" aria-hidden />
            Sessions
          </CardTitle>
          <CardDescription>End this session everywhere.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="danger" onClick={logoutAll}>
            Sign out everywhere
          </Button>
        </CardContent>
      </Card>

      <Dialog
        open={mfaDialog !== null}
        onOpenChange={(open) => {
          if (!open) setMfaDialog(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Add the account to your authenticator app, then confirm with a code.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Manual entry key</p>
              <p className="mt-1 break-all rounded-lg bg-pale p-3 font-mono text-sm font-semibold text-ink">
                {mfaDialog?.secret}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Setup URI</p>
              <p className="mt-1 break-all rounded-lg bg-pale p-3 font-mono text-xs text-ink">{mfaDialog?.otpauthUri}</p>
            </div>
          </div>
          <form onSubmit={confirmEnrollment} className="space-y-3">
            {mfaError ? <p className="text-sm text-red-600">{mfaError}</p> : null}
            <FormField id="sysMfaCode" label="Verification code" required>
              <Input
                id="sysMfaCode"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center font-mono tracking-[0.4em]"
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMfaDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={mfaBusy} disabled={mfaBusy}>
                Confirm & enable
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Badge({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={
        enabled
          ? 'inline-flex items-center gap-1 rounded-full bg-accent-200 px-2.5 py-0.5 text-xs font-semibold text-forest-800'
          : 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600'
      }
    >
      {enabled ? 'On' : 'Off'}
    </span>
  );
}
