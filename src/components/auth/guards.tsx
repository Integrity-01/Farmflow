import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessPath } from '@/components/layout/nav';
import { useAuthStore } from '@/store/auth.store';
import type { UserRole } from '@/types';

function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="size-9 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
        <p className="text-sm font-medium text-slate-500">Loading FarmFlow…</p>
      </div>
    </div>
  );
}

export function AppGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  const role = user?.role as UserRole | null;
  if (!canAccessPath(location.pathname, role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function GuestGuard({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <FullPageLoader />;
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}