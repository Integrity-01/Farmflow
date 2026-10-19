import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { bootstrapSystemAuth } from '@/services/system';
import { useSystemAdminStore } from '@/store/systemAdmin.store';

let bootstrapped = false;

export function SystemBrandSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-forest-950 text-white">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-400 text-forest-950 shadow-glass">
        <ShieldCheck className="size-8" aria-hidden />
      </div>
      <p className="mt-5 text-sm font-semibold tracking-wide text-forest-100">FarmFlow System</p>
      <p className="mt-1 text-xs text-forest-100/70">Restoring secure session…</p>
    </div>
  );
}

export function SystemGuard({ children }: { children: ReactNode }) {
  const status = useSystemAdminStore((state) => state.status);
  const user = useSystemAdminStore((state) => state.user);
  const location = useLocation();
  const [, forceRender] = useState(0);

  useEffect(() => {
    if (bootstrapped) return;
    bootstrapped = true;
    void bootstrapSystemAuth().finally(() => forceRender((value) => value + 1));
  }, []);

  if (status === 'loading') {
    return <SystemBrandSplash />;
  }

  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/system/login?next=${next}`} replace />;
  }

  if (user?.mustChangePassword && location.pathname !== '/system/change-password') {
    return <Navigate to="/system/change-password" replace />;
  }

  return <>{children}</>;
}

export function SystemGuestGuard({ children }: { children: ReactNode }) {
  const status = useSystemAdminStore((state) => state.status);

  if (status === 'loading') {
    return <SystemBrandSplash />;
  }

  if (status === 'authenticated') {
    const user = useSystemAdminStore.getState().user;
    return <Navigate to={user?.mustChangePassword ? '/system/change-password' : '/system/overview'} replace />;
  }

  return <>{children}</>;
}
