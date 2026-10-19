import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SystemSidebar } from '@/components/system/SystemSidebar';
import { SystemTopBar } from '@/components/system/SystemTopBar';
import { useSystemAdminStore } from '@/store/systemAdmin.store';

const TITLES: Array<{ prefix: string; title: string }> = [
  { prefix: '/system/overview', title: 'Platform Overview' },
  { prefix: '/system/organizations/', title: 'Organization Details' },
  { prefix: '/system/organizations', title: 'Organizations' },
  { prefix: '/system/users', title: 'Users' },
  { prefix: '/system/analytics', title: 'Platform Analytics' },
  { prefix: '/system/audit-logs', title: 'Audit Logs' },
  { prefix: '/system/health', title: 'System Health' },
  { prefix: '/system/administrators', title: 'System Administrators' },
  { prefix: '/system/settings', title: 'Account Settings' },
  { prefix: '/system/change-password', title: 'Change Password' },
];

export function SystemShell() {
  const user = useSystemAdminStore((state) => state.user);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = useMemo(() => {
    const match = TITLES.find((entry) => location.pathname.startsWith(entry.prefix));
    return match?.title ?? 'System';
  }, [location.pathname]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-dvh bg-pale text-ink">
      <div className="hidden lg:block">
        <SystemSidebar user={user} className="sticky top-0 h-dvh" />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-forest-950/50 backdrop-blur-sm"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] shadow-lift">
            <SystemSidebar
              user={user}
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <SystemTopBar user={user} title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
