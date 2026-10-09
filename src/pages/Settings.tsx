import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, Copy, KeyRound, Loader2, Mail, MessageCircle, Save, ShieldCheck, Unlink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Separator } from '@/components/ui/Separator';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { settingsApi } from '@/services/settings';
import { whatsappApi } from '@/services/whatsapp';
import { pushPermissionStatus, subscribeDevicePush, unsubscribeDevicePush } from '@/services/push';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import { ROLE_LABELS, type NotificationPrefs } from '@/types';

const CHANNEL_ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'emailEnabled', label: 'Email', description: 'Receive important updates by email.' },
  { key: 'pushEnabled', label: 'Push notifications', description: 'Prompt you on your device.' },
  { key: 'inAppEnabled', label: 'In-app', description: 'Show notifications inside FarmFlow.' },
  { key: 'whatsappEnabled', label: 'WhatsApp', description: 'Send alerts to your connected WhatsApp number.' },
];

const ALERT_ITEMS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: 'taskAssignments', label: 'Task assignments', description: 'When a task is assigned to you.' },
  { key: 'deadlineReminders', label: 'Deadline reminders', description: 'Shortly before a task is due.' },
  { key: 'overdueAlerts', label: 'Overdue alerts', description: 'When a task passes its deadline.' },
  { key: 'taskCompletions', label: 'Task completions', description: 'When a task is marked finished.' },
  { key: 'dailySummary', label: 'Daily summary', description: 'A digest of the day in one message.' },
];

function PreferencesSwitch({
  item,
  checked,
  onToggle,
  disabled,
}: {
  item: { key: keyof NotificationPrefs; label: string; description: string };
  checked: boolean;
  onToggle: (checked: boolean) => void;
  disabled: boolean;
}) {
  const id = `pref-${item.key}`;
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-sm font-medium text-slate-900">
          {item.label}
        </label>
        <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onToggle} disabled={disabled} />
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushPermission, setPushPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [pushNotice, setPushNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone ?? '');
    }
  }, [user?.id]);

  useEffect(() => {
    void pushPermissionStatus().then(setPushPermission);
  }, []);

  const prefsQuery = useQuery({
    queryKey: ['settings', 'notification-prefs'],
    queryFn: settingsApi.getNotificationPrefs,
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const profileMutation = useMutation({
    mutationFn: settingsApi.updateProfile,
    onSuccess: (updated) => {
      useAuthStore.getState().setUser(updated);
      useToastStore.getState().add({ title: 'Profile updated', description: 'Your details have been saved.' });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not update profile',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const prefsMutation = useMutation({
    mutationFn: (input: Partial<NotificationPrefs>) => settingsApi.updateNotificationPrefs(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['settings', 'notification-prefs'] });
      const previous = queryClient.getQueryData<NotificationPrefs>(['settings', 'notification-prefs']);
      if (previous) {
        queryClient.setQueryData<NotificationPrefs>(['settings', 'notification-prefs'], {
          ...previous,
          ...input,
        });
      }
      return { previous };
    },
    onError: (err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData<NotificationPrefs>(['settings', 'notification-prefs'], context.previous);
      }
      useToastStore.getState().add({
        title: 'Could not update preferences',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['settings', 'notification-prefs'] });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: settingsApi.changePassword,
    onSuccess: () => {
      useToastStore.getState().add({
        title: 'Password changed',
        description: 'Your sessions were signed out. Please sign in again.',
      });
      useAuthStore.getState().clearSession();
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not change password',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const prefs = prefsQuery.data;
  const passwordsMatch = newPassword === confirmPassword;

  const whatsappStatusQuery = useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: whatsappApi.status,
    staleTime: 30_000,
    retry: 0,
  });

  const inviteMutation = useMutation({
    mutationFn: whatsappApi.generateInvite,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
      useToastStore.getState().add({
        title: 'Invite code ready',
        description: 'Send the code to the number you want to connect, then reply "join <code>" on WhatsApp.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not generate an invite',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: whatsappApi.revoke,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
      useToastStore.getState().add({
        title: 'WhatsApp link removed',
        description: 'This number will no longer receive FarmFlow messages.',
      });
    },
    onError: (err) => {
      useToastStore.getState().add({
        title: 'Could not remove the link',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'danger',
      });
    },
  });

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard can be blocked in embedded browsers; the code stays visible.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    profileMutation.mutate({ name: name.trim(), phone: phone.trim() || null });
  }

  function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (!passwordsMatch) {
      useToastStore.getState().add({
        title: 'Passwords do not match',
        description: 'Make sure the new password is typed the same in both fields.',
        variant: 'danger',
      });
      return;
    }
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    if (key === 'pushEnabled') {
      setPushBusy(true);
      if (value) {
        const subscribed = await subscribeDevicePush();
        const perm = await pushPermissionStatus();
        setPushPermission(perm);
        if (subscribed) {
          setPushNotice(null);
        } else if (perm === 'denied') {
          setPushNotice('Notifications are blocked for this browser. Allow them in your site settings to receive alerts.');
        } else if (perm === 'unsupported') {
          setPushNotice("This browser doesn't support web push, so you'll get in-app notifications only.");
        } else {
          setPushNotice('Could not set up notifications on this device. Please try again.');
        }
      } else {
        await unsubscribeDevicePush();
        setPushNotice(null);
      }
      setPushBusy(false);
    }
    prefsMutation.mutate({ [key]: value });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Manage your account, notifications and security.</p>
      </section>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 pt-6">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <BadgeCheck className="size-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">{user?.name ?? 'Your account'}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3.5" aria-hidden />
                {user?.email}
              </span>
            </p>
          </div>
          <Badge variant="info">
            <ShieldCheck className="size-3.5" aria-hidden />
            {user ? ROLE_LABELS[user.role] : ''}
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile details</CardTitle>
              <CardDescription>Your name and contact number shown to your team.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-name">Full name</Label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      aria-invalid={name.trim().length > 0 && name.trim().length < 2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="profile-phone">Phone (optional)</Label>
                    <Input
                      id="profile-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+1 555 000 1234"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button type="submit" loading={profileMutation.isPending} disabled={name.trim().length < 2}>
                    {profileMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    Save changes
                  </Button>
                  <span className="text-xs text-slate-400">Your email address is used to sign in and can't be changed here.</span>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification preferences</CardTitle>
              <CardDescription>Choose how and when FarmFlow reaches you.</CardDescription>
            </CardHeader>
            <CardContent>
              {prefsQuery.isLoading ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((item) => (
                    <Skeleton key={item} className="h-12 w-full" />
                  ))}
                </div>
              ) : prefs ? (
                <div className="divide-y divide-slate-100">
                  <div className="py-1">
                    <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Channels</p>
                    {CHANNEL_ITEMS.map((item) => (
                      <PreferencesSwitch
                        key={item.key}
                        item={item}
                        checked={prefs[item.key]}
                        onToggle={(value) => void togglePref(item.key, value)}
                        disabled={prefsMutation.isPending || (item.key === 'pushEnabled' && pushBusy)}
                      />
                    ))}
                    {pushPermission === 'default' ? (
                      <p className="pb-2 pt-3 text-xs text-slate-500">
                        Push covers this device too — toggle Push notifications on and your browser will ask for
                        permission. When the app is open you'll still get in-app alerts.
                      </p>
                    ) : null}
                    {pushNotice ? <p className="pb-2 pt-3 text-xs text-amber-700">{pushNotice}</p> : null}
                  </div>
                  <Separator />
                  <div className="py-1">
                    <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Alerts</p>
                    {ALERT_ITEMS.map((item) => (
                      <PreferencesSwitch
                        key={item.key}
                        item={item}
                        checked={prefs[item.key]}
                        onToggle={(value) => togglePref(item.key, value)}
                        disabled={prefsMutation.isPending}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="size-5 text-brand-600" aria-hidden />
                WhatsApp connect
              </CardTitle>
              <CardDescription>
                Link a phone number and turn FarmFlow into your pocket assistant — alerts and Q&A on WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {whatsappStatusQuery.isLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((item) => (
                    <Skeleton key={item} className="h-12 w-full" />
                  ))}
                </div>
              ) : whatsappStatusQuery.data ? (
                <div className="space-y-4">
                  {!whatsappStatusQuery.data.configured ? (
                    <div className="space-y-3">
                      <p className="text-sm leading-relaxed text-slate-600">
                        FarmFlow can chat with you on WhatsApp, but this deployment isn't connected to the WhatsApp
                        Cloud API yet. An admin needs to add <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">WHATSAPP_TOKEN</code>,{' '}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">WHATSAPP_PHONE_ID</code>,{' '}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">WHATSAPP_VERIFY_TOKEN</code> and{' '}
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">WHATSAPP_WEBHOOK_SECRET</code> to the
                        server's <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env</code>, then come back here.
                      </p>
                      <p className="text-sm text-slate-500">
                        The full setup guide lives in <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">docs/whatsapp.md</code>.
                      </p>
                    </div>
                  ) : whatsappStatusQuery.data.status === 'active' ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                          <Check className="size-4" aria-hidden />
                          Connected
                        </p>
                        <p className="mt-1 text-sm text-emerald-700">
                          {'+'}
                          {whatsappStatusQuery.data.number ?? ''}
                          {whatsappStatusQuery.data.waName ? ` · ${whatsappStatusQuery.data.waName}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-emerald-600">
                          {whatsappStatusQuery.data.sessionActive
                            ? 'Session active — you can chat right now.'
                            : 'No recent session. Send a message to start chatting again.'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        type="button"
                        loading={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate()}
                      >
                        <Unlink className="size-4" aria-hidden />
                        Remove this number
                      </Button>
                    </div>
                  ) : inviteMutation.isPending ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {whatsappStatusQuery.data.status === 'revoked' ? (
                        <p className="text-sm text-slate-500">Your previous link was removed. Generate a fresh invite to reconnect.</p>
                      ) : null}
                      {whatsappStatusQuery.data.inviteCode ? (
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-lg font-semibold tracking-widest text-brand-700">
                              {whatsappStatusQuery.data.inviteCode}
                            </code>
                            <Button variant="outline" type="button" onClick={() => void copyInvite(whatsappStatusQuery.data!.inviteCode!)}>
                              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                              {copied ? 'Copied' : 'Copy'}
                            </Button>
                          </div>
                          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
                            <li>Open WhatsApp on the phone you want to connect.</li>
                            <li>Message the FarmFlow number (the one linked to this deployment).</li>
                            <li>
                              Reply with{' '}
                              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                                join {whatsappStatusQuery.data.inviteCode}
                              </code>
                              .
                            </li>
                          </ol>
                          <p className="text-xs text-slate-400">
                            The invite stays valid until the number connects. Generating a new one replaces the old code.
                          </p>
                          <Button variant="outline" type="button" onClick={() => inviteMutation.mutate()}>
                            Generate a new code
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm leading-relaxed text-slate-600">
                            Create an invite code, message the FarmFlow WhatsApp number, and reply{' '}
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">join &lt;code&gt;</code> to bind your
                            account. Once linked, switch on the WhatsApp channel under Notifications.
                          </p>
                          <Button type="button" onClick={() => inviteMutation.mutate()}>
                            <MessageCircle className="size-4" aria-hidden />
                            Generate invite code
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Change password</CardTitle>
              <CardDescription>Use at least 8 characters. Changing it signs you out everywhere.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="max-w-md space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="current-password">Current password</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      placeholder="Your current password"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      aria-invalid={newPassword.length > 0 && newPassword.length < 8}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Repeat the new password"
                      aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    />
                  </div>
                </div>
                <Button type="submit" loading={passwordMutation.isPending} disabled={!currentPassword || newPassword.length < 8}>
                  {passwordMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <KeyRound className="size-4" aria-hidden />
                  )}
                  Update password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}