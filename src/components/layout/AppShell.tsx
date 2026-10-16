import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/app.store';
import { BottomNav } from './BottomNav';
import { OfflineBanner } from './OfflineBanner';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const setOnline = useAppStore((state) => state.setOnline);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-dvh">
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_88%_-12%,rgba(168,240,90,0.18),transparent),radial-gradient(52rem_36rem_at_-12%_18%,rgba(38,116,71,0.10),transparent)]"
        />
        <OfflineBanner />
        <Sidebar />

        <div
          className={cn(
            'transition-[padding] duration-200',
            collapsed ? 'lg:pl-16' : 'lg:pl-64',
          )}
        >
          <TopBar />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <Outlet />
          </main>
        </div>

        <BottomNav />
      </div>
    </TooltipProvider>
  );
}