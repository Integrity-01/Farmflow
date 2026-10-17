import { useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPath } from '@/components/layout/nav';
import { BrandSplash } from '@/components/auth/BrandSplash';
import { Button } from '@/components/ui/Button';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';
import { Clock, Sprout } from 'lucide-react';

/** Routes a signed-in user may open even while their membership is pending. */
const PENDING_ALLOWED_PATHS = new Set(['/accept-invitation']);

function PendingAccess() {
  const user = useAuthStore((state) => state.user);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingOrg = user?.orgs?.find((org) => org.status === 'pending') ?? null;
  const orgName = pendingOrg?.name ?? user?.currentOrg?.name ?? null;

  async function recheck() {
    setChecking(true);
    setError(null);
    try {
      const fresh = await authApi.me();
      useAuthStore.getState().setUser(fresh);
    } catch {
      setError('We could not check your status. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  async function signOut() {
    try {
      await authApi.logout();
    } catch {
      // Signing out locally is still fine if the request fails.
    }
    useAuthStore.getState().clearSession();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          {orgName ? <Clock className="size-7" aria-hidden /> : <Sprout className="size-7" aria-hidden />}
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          {orgName ? `Joining ${orgName}` : 'No organization yet'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {orgName
            ? 'Your account is waiting for an administrator to approve it. Once approved, you can sign in and start working right away.'
            : 'Your account is not linked to an organization. Ask your administrator for an organization key, or contact support if you think this is a mistake.'}
        </p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 space-y-3">
          <Button className="w-full" loading={checking} onClick={() => void recheck()}>
            {orgName ? 'Check status' : 'Try again'}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (status === 'loading') {
    return <BrandSplash />;
  }

  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!user?.currentOrg && !PENDING_ALLOWED_PATHS.has(location.pathname)) {
    return <PendingAccess />;
  }

  const role = user?.role ?? null;
  const permissions = user?.currentOrg?.permissions ?? null;
  if (role && !canAccessPath(location.pathname, role, permissions)) {
    return <Navigate to="/profile" replace />;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <BrandSplash />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
