import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Switch } from '@/components/ui/Switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { ApiError } from '@/services/api';
import { organizationApi, type UpdateOrgSettingsInput } from '@/services/organization';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';
import type { MembershipStatus, OrganizationMember } from '@/types';

type Tab = 'members' | 'requests' | 'invitations' | 'access' | 'admins' | 'settings';

const STATUS_LABEL: Record<MembershipStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  suspended: 'Suspended',
};

const STATUS_BADGE: Record<MembershipStatus, 'success' | 'warning' | 'danger'> = {
  active: 'success',
  pending: 'warning',
  suspended: 'danger',
};

function notify(title: string, description: string, variant?: 'danger') {
  useToastStore.getState().add({ title, description, variant });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function Team() {
  const user = useAuthStore((state) => state.user);
  const role = (user?.currentOrg?.role ?? user?.role) || null;
  const isAdmin = role === 'organization_administrator';
  const canInvite = isAdmin || role === 'farm_manager';

  const orgName = user?.currentOrg?.name ?? 'your organization';

  const [tab, setTab] = useState<Tab>('members');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Team</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Manage who can access {orgName} and what they can do.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          {isAdmin ? <TabsTrigger value="requests">Requests</TabsTrigger> : null}
          {canInvite ? <TabsTrigger value="invitations">Invitations</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="access">Access key</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="admins">Admin IDs</TabsTrigger> : null}
          {isAdmin ? <TabsTrigger value="settings">Settings</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="members">
          <MembersTab isAdmin={isAdmin} currentUserId={user?.id ?? null} />
        </TabsContent>
        {isAdmin ? (
          <TabsContent value="requests">
            <RequestsTab />
          </TabsContent>
        ) : null}
        {canInvite ? (
          <TabsContent value="invitations">
            <InvitationsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="access">
            <AccessKeyTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="admins">
            <AdminCredentialsTab />
          </TabsContent>
        ) : null}
        {isAdmin ? (
          <TabsContent value="settings">
            <JoinSettingsTab />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function MembersTab({ isAdmin, currentUserId }: { isAdmin: boolean; currentUserId: string | null }) {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<OrganizationMember | null>(null);

  const membersQuery = useQuery({
    queryKey: ['org-members'],
    queryFn: organizationApi.listMembers,
    retry: 0,
  });

  const rolesQuery = useQuery({
    queryKey: ['org-roles'],
    queryFn: organizationApi.listRoles,
    retry: 0,
    enabled: isAdmin,
  });

  const roles = rolesQuery.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: { roleId?: string; status?: 'active' | 'suspended' } }) =>
      organizationApi.updateMember(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org-members'] });
      notify('Member updated', 'The membership was updated.');
    },
    onError: (error) =>
      notify('Could not update member', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => organizationApi.removeMember(id),
    onSuccess: async () => {
      setRemoveTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['org-members'] });
      notify('Member removed', 'They no longer have access to this organization.');
    },
    onError: (error) =>
      notify('Could not remove member', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const members = membersQuery.data ?? [];

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-3 pt-3">
        {[0, 1, 2].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (membersQuery.isError) {
    return (
      <div className="pt-3">
        <Alert variant="danger">
          <AlertTitle>Could not load members</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage(membersQuery.error, 'Please try again.')}</p>
            <Button variant="outline" size="sm" onClick={() => void membersQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <EmptyState
        className="pt-3"
        icon={Users}
        title="No members yet"
        description="Invite people to your organization to get started."
      />
    );
  }

  return (
    <div className="pt-3">
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
              {isAdmin ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <p className="font-semibold text-slate-900">{member.name}</p>
                  <p className="text-xs text-slate-500">{member.email}</p>
                </TableCell>
                <TableCell className="text-slate-600">
                  {member.phone ? (
                    <p className="flex items-center gap-1.5 text-sm">
                      <Phone className="size-3.5 text-slate-400" aria-hidden />
                      {member.phone}
                    </p>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {isAdmin && member.userId !== currentUserId ? (
                    <Select
                      value={member.roleId}
                      onValueChange={(value) =>
                        updateMutation.mutate({ id: member.id, input: { roleId: value } })
                      }
                    >
                      <SelectTrigger className="h-9 w-52" aria-label="Change role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-medium text-slate-700">{member.roleName}</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[member.status]}>{STATUS_LABEL[member.status]}</Badge>
                </TableCell>
                <TableCell className="text-sm text-slate-500">{formatDate(member.joinedAt)}</TableCell>
                {isAdmin ? (
                  <TableCell className="text-right">
                    {member.userId !== currentUserId ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updateMutation.isPending}
                          onClick={() =>
                            updateMutation.mutate({
                              id: member.id,
                              input: { status: member.status === 'suspended' ? 'active' : 'suspended' },
                            })
                          }
                        >
                          {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setRemoveTarget(member)}
                        >
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">You</span>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 lg:hidden">
        {members.map((member) => (
          <li key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{member.name}</p>
                <p className="truncate text-xs text-slate-500">{member.email}</p>
              </div>
              <Badge variant={STATUS_BADGE[member.status]}>{STATUS_LABEL[member.status]}</Badge>
            </div>
            <p className="mt-2 text-sm text-slate-600">{member.roleName}</p>
            {isAdmin && member.userId !== currentUserId ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: member.id,
                      input: { status: member.status === 'suspended' ? 'active' : 'suspended' },
                    })
                  }
                >
                  {member.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => setRemoveTarget(member)}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this member?</DialogTitle>
            <DialogDescription>
              "{removeTarget?.name}" will immediately lose access to this organization.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget.id)}
            >
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RequestsTab() {
  const queryClient = useQueryClient();

  const requestsQuery = useQuery({
    queryKey: ['org-member-requests'],
    queryFn: organizationApi.listMemberRequests,
    retry: 0,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => organizationApi.approveMember(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org-member-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['org-members'] }),
      ]);
      notify('Request approved', 'The person now has access to this organization.');
    },
    onError: (error) =>
      notify('Could not approve request', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => organizationApi.rejectMember(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org-member-requests'] });
      notify('Request declined', 'The membership request was declined.');
    },
    onError: (error) =>
      notify('Could not decline request', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const requests = requestsQuery.data ?? [];
  const busy = approveMutation.isPending || rejectMutation.isPending;

  if (requestsQuery.isLoading) {
    return (
      <div className="space-y-3 pt-3">
        {[0, 1].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (requestsQuery.isError) {
    return (
      <div className="pt-3">
        <Alert variant="danger">
          <AlertTitle>Could not load requests</AlertTitle>
          <AlertDescription>{errorMessage(requestsQuery.error, 'Please try again.')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        className="pt-3"
        icon={ShieldCheck}
        title="No pending requests"
        description="People who join with an access key will appear here for approval."
      />
    );
  }

  return (
    <div className="space-y-3 pt-3">
      {requests.map((request) => (
        <Card key={request.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{request.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-slate-500">
                <Mail className="size-3.5 text-slate-400" aria-hidden />
                {request.email}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Requested {formatDate(request.requestedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => rejectMutation.mutate(request.id)}
              >
                Decline
              </Button>
              <Button size="sm" disabled={busy} onClick={() => approveMutation.mutate(request.id)}>
                <Check className="size-4" aria-hidden />
                Approve
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InvitationsTab() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const invitationsQuery = useQuery({
    queryKey: ['org-invitations'],
    queryFn: organizationApi.listInvitations,
    retry: 0,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => organizationApi.revokeInvitation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
      notify('Invitation revoked', 'The invitation can no longer be used.');
    },
    onError: (error) =>
      notify('Could not revoke invitation', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const invitations = invitationsQuery.data ?? [];

  return (
    <div className="space-y-4 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Invite people by email. Invitations expire after 7 days.
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" aria-hidden />
          Invite someone
        </Button>
      </div>

      {invitationsQuery.isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((item) => (
            <Skeleton key={item} className="h-14 w-full" />
          ))}
        </div>
      ) : invitationsQuery.isError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load invitations</AlertTitle>
          <AlertDescription>{errorMessage(invitationsQuery.error, 'Please try again.')}</AlertDescription>
        </Alert>
      ) : invitations.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No pending invitations"
          description="Invitations you send will appear here until they are accepted."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="font-medium text-slate-900">{invitation.email}</TableCell>
                  <TableCell className="text-slate-600">{invitation.roleName}</TableCell>
                  <TableCell className="text-sm text-slate-500">{formatDate(invitation.expiresAt)}</TableCell>
                  <TableCell className="text-sm text-slate-500">{formatDate(invitation.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(invitation.id)}
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rolesQuery = useQuery({
    queryKey: ['org-roles'],
    queryFn: organizationApi.listRoles,
    retry: 0,
    enabled: open,
  });
  const roles = rolesQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: () => organizationApi.createInvitation({ email: email.trim(), roleId }),
    onSuccess: async (result) => {
      setInviteUrl(result.inviteUrl);
      await queryClient.invalidateQueries({ queryKey: ['org-invitations'] });
      notify('Invitation sent', `An invitation was sent to ${email.trim()}.`);
    },
    onError: (error) =>
      notify('Could not send invitation', errorMessage(error, 'Please try again.'), 'danger'),
  });

  function reset() {
    setEmail('');
    setRoleId('');
    setInviteUrl(null);
    setCopied(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy failed', 'Please copy the link manually.', 'danger');
    }
  }

  const canSubmit = email.trim().length > 0 && roleId.length > 0 && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            We will email them an invitation link, and show it here so you can share it directly.
          </DialogDescription>
        </DialogHeader>

        {inviteUrl ? (
          <div className="space-y-3">
            <Alert variant="success">
              <AlertTitle>Invitation ready</AlertTitle>
              <AlertDescription>
                Share this link with <strong>{email.trim()}</strong>.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} aria-label="Invitation link" />
              <Button variant="outline" onClick={() => void copyLink()}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormField id="invite-email" label="Email address" required>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                placeholder="person@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </FormField>
            <FormField id="invite-role" label="Role" required>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="invite-role" aria-label="Role">
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
        )}

        <DialogFooter>
          {inviteUrl ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button loading={createMutation.isPending} disabled={!canSubmit} onClick={() => createMutation.mutate()}>
                Send invitation
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccessKeyTab() {
  const [accessKey, setAccessKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => organizationApi.generateAccessKey(),
    onSuccess: (key) => {
      setAccessKey(key);
      notify('Access key generated', 'Share it only with people you trust.');
    },
    onError: (error) =>
      notify('Could not generate key', errorMessage(error, 'Please try again.'), 'danger'),
  });

  const rotateMutation = useMutation({
    mutationFn: () => organizationApi.rotateAccessKey(),
    onSuccess: (key) => {
      setAccessKey(key);
      notify('Access key rotated', 'The previous key has been revoked.');
    },
    onError: (error) =>
      notify('Could not rotate key', errorMessage(error, 'Please try again.'), 'danger'),
  });

  async function copyKey() {
    if (!accessKey) return;
    try {
      await navigator.clipboard.writeText(accessKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy failed', 'Please copy the key manually.', 'danger');
    }
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Organization access key</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          People who join with an access key are added as field officers and must be
          approved by an administrator before they can access data.
        </p>

        {accessKey ? (
          <div className="flex gap-2">
            <Input readOnly value={accessKey} aria-label="Access key" />
            <Button variant="outline" onClick={() => void copyKey()}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant={accessKey ? 'outline' : 'primary'}
            loading={generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <KeyRound className="size-4" aria-hidden />
            {accessKey ? 'Generate another key' : 'Generate access key'}
          </Button>
          <Button
            variant="outline"
            loading={rotateMutation.isPending}
            onClick={() => rotateMutation.mutate()}
          >
            <KeyRound className="size-4" aria-hidden />
            Rotate key
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          Rotating revokes the current key and issues a fresh one. Everyone who has the old key
          will need the new one to join.
        </p>
      </CardContent>
    </Card>
  );
}

function AdminCredentialsTab() {
  const queryClient = useQueryClient();

  const credentialsQuery = useQuery({
    queryKey: ['admin-credentials'],
    queryFn: organizationApi.listAdminCredentials,
  });
  const membersQuery = useQuery({
    queryKey: ['org-members'],
    queryFn: organizationApi.listMembers,
  });

  const enrollMutation = useMutation({
    mutationFn: (membershipId: string) => organizationApi.enrollAdminCredential(membershipId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-credentials'] });
      notify('Admin ID issued', 'The administrator can now sign in with their Admin ID.');
    },
    onError: (error) =>
      notify('Could not issue Admin ID', errorMessage(error, 'Please try again.'), 'danger'),
  });

  if (credentialsQuery.isLoading) {
    return <Skeleton className="mt-3 h-40 w-full" />;
  }

  if (credentialsQuery.isError) {
    return (
      <Alert variant="danger" className="mt-3">
        <AlertTitle>Could not load Admin IDs</AlertTitle>
        <AlertDescription>
          <p>{errorMessage(credentialsQuery.error, 'Please try again.')}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void credentialsQuery.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const credentials = credentialsQuery.data ?? [];
  const admins = (membersQuery.data ?? []).filter(
    (member) => member.role === 'organization_administrator' && member.status === 'active',
  );
  const withCredential = new Set(credentials.map((credential) => credential.userId));
  const missing = admins.filter((member) => !withCredential.has(member.userId));

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Administrator Admin IDs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-slate-500">
          Administrators sign in with an Admin ID and password instead of an email address. FarmFlow
          generates Admin IDs — they cannot be chosen or changed.
        </p>

        {credentials.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
            No Admin IDs have been issued for this organization yet.
          </p>
        ) : (
          <div className="space-y-2">
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="font-mono text-sm font-semibold tracking-wide text-slate-900">
                    {credential.adminId}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {credential.name} · {credential.email}
                  </p>
                </div>
                <Badge variant={credential.status === 'active' ? 'success' : 'danger'}>
                  {credential.status === 'active' ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {missing.length > 0 ? (
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700">
              Administrators without an Admin ID
            </p>
            {missing.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{member.name}</p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
                <Button
                  size="sm"
                  loading={enrollMutation.isPending && enrollMutation.variables === member.id}
                  onClick={() => enrollMutation.mutate(member.id)}
                >
                  Issue Admin ID
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function JoinSettingsTab() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['org-settings'],
    queryFn: organizationApi.getSettings,
    retry: 0,
  });

  const rolesQuery = useQuery({
    queryKey: ['org-roles'],
    queryFn: organizationApi.listRoles,
    retry: 0,
  });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateOrgSettingsInput) => organizationApi.updateSettings(input),
    onSuccess: async (settings) => {
      queryClient.setQueryData(['org-settings'], settings);
      notify('Settings saved', 'New-member settings were updated.');
    },
    onError: (error) =>
      notify('Could not save settings', errorMessage(error, 'Please try again.'), 'danger'),
  });

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-3 pt-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="pt-3">
        <Alert variant="danger">
          <AlertTitle>Could not load settings</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{errorMessage(settingsQuery.error, 'Please try again.')}</p>
            <Button variant="outline" size="sm" onClick={() => void settingsQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const settings = settingsQuery.data;
  const approval = settings?.selfJoin === 'approval';
  const roles = (rolesQuery.data ?? []).filter((role) => role.code !== 'organization_administrator');

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Join settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">Require approval for new members</p>
            <p className="mt-1 text-sm text-slate-500">
              {approval
                ? 'People who register with the organization key wait for an administrator to approve them before accessing data.'
                : 'People who register with the organization key join immediately with the default role below.'}
            </p>
          </div>
          <Switch
            checked={approval}
            disabled={updateMutation.isPending}
            onCheckedChange={(checked) =>
              updateMutation.mutate({ selfJoin: checked ? 'approval' : 'open' })
            }
            aria-label="Require approval for new members"
          />
        </div>

        <div className="border-t border-slate-100 pt-4">
          <FormField
            id="default-role"
            label="Default role for new members"
            hint="Applied to people who register with the organization key. It can never be an administrator role."
          >
            <Select
              value={settings?.defaultRole}
              disabled={updateMutation.isPending}
              onValueChange={(value) => updateMutation.mutate({ defaultRole: value })}
            >
              <SelectTrigger id="default-role" aria-label="Default role for new members">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.code}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </CardContent>
    </Card>
  );
}
