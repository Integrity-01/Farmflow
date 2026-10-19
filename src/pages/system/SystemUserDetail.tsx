import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building2, Mail, Phone, User } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { systemPlatformApi } from '@/services/system';
import { formatDate, humanizeAction, humanizeRole } from '@/components/system/format';

const STATUS_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  active: 'success',
  suspended: 'danger',
  pending: 'warning',
};

export function SystemUserDetail() {
  const { id = '' } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'user', id],
    queryFn: () => systemPlatformApi.user(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={User}
        title="User not found"
        action={
          <Button asChild variant="outline">
            <Link to="/system/users">Back to users</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/system/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold tracking-tight text-ink">{data.name}</h2>
            <Badge variant={data.isActive ? 'success' : 'danger'}>{data.isActive ? 'Active' : 'Inactive'}</Badge>
            <Badge variant="outline">{humanizeRole(data.role)}</Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4" aria-hidden />
              {data.email}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4" aria-hidden />
              {data.phone ?? 'No phone'}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Joined {formatDate(data.createdAt)} · Last sign-in {data.lastLoginAt ? formatDate(data.lastLoginAt) : 'never'}
          </p>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Building2 className="size-5 text-forest-600" aria-hidden />
            Organization memberships
          </CardTitle>
        </CardHeader>
        {data.memberships.length === 0 ? (
          <EmptyState icon={Building2} title="No memberships" description="This user is not linked to any organization." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Membership</TableHead>
                  <TableHead>Org status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.memberships.map((membership) => (
                  <TableRow key={membership.organizationId}>
                    <TableCell>
                      <Link
                        to={`/system/organizations/${membership.organizationId}`}
                        className="font-semibold text-ink hover:text-forest-700 hover:underline"
                      >
                        {membership.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted">{humanizeRole(membership.roleName || membership.role)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[membership.status] ?? 'default'}>{humanizeAction(membership.status)}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[membership.organizationStatus] ?? 'default'}>
                        {humanizeAction(membership.organizationStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted">{formatDate(membership.joinedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
