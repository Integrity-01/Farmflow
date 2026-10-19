import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, ShieldCheck, ShieldOff, UserCog, Users } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { useToast } from '@/store/toast.store';
import { useSystemAdminStore } from '@/store/systemAdmin.store';
import { ApiError } from '@/services/api';
import { systemPlatformApi } from '@/services/system';
import { formatDateTime } from '@/components/system/format';
import type { SystemAdmin } from '@/types/system';

interface Secret {
  title: string;
  adminId: string;
  password: string;
}

export function SystemAdministrators() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const currentUser = useSystemAdminStore((state) => state.user);

  const [createOpen, setCreateOpen] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [target, setTarget] = useState<SystemAdmin | null>(null);
  const [confirmAction, setConfirmAction] = useState<'disable' | 'reset' | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'administrators'],
    queryFn: () => systemPlatformApi.administrators(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      systemPlatformApi.createAdministrator({
        name: name.trim(),
        email: email.trim() || undefined,
        isOwner,
      }),
    onSuccess: (result) => {
      setSecret({
        title: 'Administrator created',
        adminId: result.admin.adminId,
        password: result.temporaryPassword,
      });
      setCreateOpen(false);
      resetForm();
      void queryClient.invalidateQueries({ queryKey: ['system', 'administrators'] });
    },
    onError: (error) => {
      setFieldErrors({ form: error instanceof ApiError ? error.message : 'Please try again.' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'disabled' }) =>
      systemPlatformApi.setAdministratorStatus(id, status),
    onSuccess: (_result, variables) => {
      toast({
        title: variables.status === 'disabled' ? 'Administrator disabled' : 'Administrator enabled',
        variant: 'success',
      });
      void queryClient.invalidateQueries({ queryKey: ['system', 'administrators'] });
    },
    onError: (error) => {
      toast({
        title: 'Action failed',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        variant: 'danger',
      });
    },
    onSettled: () => {
      setTarget(null);
      setConfirmAction(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => systemPlatformApi.resetAdministratorPassword(id),
    onSuccess: (result, id) => {
      const admin = data?.items.find((item) => item.id === id);
      setSecret({
        title: 'Password reset',
        adminId: admin?.adminId ?? '',
        password: result.temporaryPassword,
      });
      void queryClient.invalidateQueries({ queryKey: ['system', 'administrators'] });
    },
    onError: (error) => {
      toast({
        title: 'Reset failed',
        description: error instanceof ApiError ? error.message : 'Please try again.',
        variant: 'danger',
      });
    },
    onSettled: () => {
      setTarget(null);
      setConfirmAction(null);
    },
  });

  function resetForm() {
    setName('');
    setEmail('');
    setIsOwner(false);
    setFieldErrors({});
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setFieldErrors({ name: 'Please enter a full name.' });
      return;
    }
    setFieldErrors({});
    createMutation.mutate();
  }

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">System administrators</h2>
          <p className="text-sm text-muted">Platform-level identities with access to this control plane.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" aria-hidden />
          New administrator
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : isError || items.length === 0 ? (
          <EmptyState icon={Users} title="No administrators found" description={isError ? 'Please try again shortly.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Administrator</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((admin) => {
                  const isSelf = admin.id === currentUser?.id;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell>
                        <p className="font-semibold text-ink">
                          {admin.name}
                          {isSelf ? <span className="ml-2 text-xs font-normal text-muted">(you)</span> : null}
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {admin.adminId}
                          {admin.email ? ` · ${admin.email}` : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.isOwner ? 'success' : 'outline'}>
                          {admin.isOwner ? 'Owner' : 'Administrator'}
                        </Badge>
                        {admin.mfaEnabled ? (
                          <Badge variant="info" className="ml-1">MFA</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={admin.status === 'active' ? 'success' : 'danger'}>
                          {admin.status === 'active' ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted">
                        {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {admin.status === 'active' ? (
                            <Button size="sm" variant="outline" disabled={isSelf} onClick={() => { setTarget(admin); setConfirmAction('disable'); }}>
                              <ShieldOff className="size-4" aria-hidden />
                              Disable
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => { setTarget(admin); statusMutation.mutate({ id: admin.id, status: 'active' }); }}>
                              <ShieldCheck className="size-4" aria-hidden />
                              Enable
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => { setTarget(admin); setConfirmAction('reset'); }}>
                            <KeyRound className="size-4" aria-hidden />
                            Reset password
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => (open ? setCreateOpen(true) : setCreateOpen(false))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2">
              <UserCog className="size-5 text-forest-600" aria-hidden />
              New system administrator
            </DialogTitle>
            <DialogDescription>
              The system generates a System Administrator ID and a temporary password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            {fieldErrors.form ? <p className="text-sm text-red-600">{fieldErrors.form}</p> : null}
            <FormField id="adminName" label="Full name" required error={fieldErrors.name}>
              <Input id="adminName" value={name} onChange={(event) => setName(event.target.value)} placeholder="Jane Doe" />
            </FormField>
            <FormField id="adminEmail" label="Email" hint="Optional — used for password recovery.">
              <Input id="adminEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="jane@farmflow.test" />
            </FormField>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <Checkbox checked={isOwner} onCheckedChange={(checked) => setIsOwner(checked === true)} />
              Grant owner access
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Create administrator
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={target !== null && confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            setConfirmAction(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === 'disable' ? `Disable ${target?.name}?` : `Reset ${target?.name}'s password?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'disable'
                ? 'This administrator will lose access immediately until re-enabled. At least one active owner must remain.'
                : 'A temporary password will be generated and must be changed on next sign-in. All sessions are revoked.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {confirmAction === 'disable' && target ? (
              <AlertDialogAction
                variant="danger"
                onClick={() => statusMutation.mutate({ id: target.id, status: 'disabled' })}
              >
                Disable account
              </AlertDialogAction>
            ) : null}
            {confirmAction === 'reset' && target ? (
              <AlertDialogAction
                onClick={() => resetMutation.mutate(target.id)}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending ? 'Resetting…' : 'Reset password'}
              </AlertDialogAction>
            ) : null}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={secret !== null}
        onOpenChange={(open) => {
          if (!open) setSecret(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{secret?.title}</DialogTitle>
            <DialogDescription>Copy these credentials now — they are shown only once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-xl bg-pale p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Administrator ID</p>
              <p className="mt-1 font-mono text-base font-bold text-ink">{secret?.adminId}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Temporary password</p>
              <p className="mt-1 break-all font-mono text-base font-bold text-ink">{secret?.password}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
