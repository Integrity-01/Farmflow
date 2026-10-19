import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Pagination, pageRange } from '@/components/ui/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { systemPlatformApi } from '@/services/system';
import { formatDate, formatNumber, humanizeRole } from '@/components/system/format';
import type { GlobalUserItem } from '@/types/system';

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: 'organization_administrator', label: 'Organization administrator' },
  { value: 'farm_manager', label: 'Farm manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'field_officer', label: 'Field officer' },
];

function UserRow({ user }: { user: GlobalUserItem }) {
  return (
    <TableRow>
      <TableCell>
        <Link to={`/system/users/${user.id}`} className="font-semibold text-ink hover:text-forest-700 hover:underline">
          {user.name}
        </Link>
        <p className="text-xs text-muted">{user.email}</p>
      </TableCell>
      <TableCell className="text-sm text-muted">{humanizeRole(user.role)}</TableCell>
      <TableCell>
        <Badge variant={user.isActive ? 'success' : 'danger'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatNumber(user.membershipCount)}</TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted">
        {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted">{formatDate(user.createdAt)}</TableCell>
    </TableRow>
  );
}

export function SystemUsers() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'users', { search: debounced, status, role, page }],
    queryFn: () =>
      systemPlatformApi.users({
        search: debounced || undefined,
        status: status === 'all' ? undefined : status,
        role: role === 'all' ? undefined : role,
        page,
        pageSize: PAGE_SIZE,
      }),
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            placeholder="Search users…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            aria-label="Search users"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={role} onValueChange={(value) => { setRole(value); setPage(1); }}>
            <SelectTrigger className="h-10 w-52" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
            <SelectTrigger className="h-10 w-36" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl" />
            ))}
          </div>
        ) : isError || items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={isError ? 'Could not load users' : 'No users found'}
            description={isError ? 'Please try again shortly.' : debounced ? 'Try a different search or filter.' : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Orgs</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.total > 0 ? (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-hairline px-5 py-4 sm:flex-row">
            <p className="text-sm text-muted">{pageRange(data.total, data.page, data.pageSize, 'users')}</p>
            <Pagination page={data.page} pageCount={data.totalPages} onPageChange={setPage} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
