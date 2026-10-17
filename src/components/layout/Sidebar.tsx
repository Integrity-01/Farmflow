import { cn } from '@/utils/cn';
import { useAppStore } from '@/store/app.store';
import { AppSidebar } from './AppSidebar';

/** Fixed, collapsible desktop sidebar (hidden below the `lg` breakpoint). */
export function Sidebar() {
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-hairline bg-white/95 backdrop-blur-xl transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <AppSidebar collapsed={collapsed} onToggleCollapse={toggleSidebar} />
    </aside>
  );
}
