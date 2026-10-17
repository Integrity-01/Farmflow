import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { DialogOverlay, DialogPortal } from '@/components/ui/Dialog';
import { useAppStore } from '@/store/app.store';
import { AppSidebar } from './AppSidebar';

/**
 * Mobile/tablet navigation drawer. Reuses the shared AppSidebar so every role
 * sees the same permission-filtered navigation. Radix Dialog supplies the focus
 * trap, Escape-to-close, scroll lock and `aria-modal` semantics.
 */
export function MobileNavDrawer() {
  const open = useAppStore((state) => state.mobileNavOpen);
  const setOpen = useAppStore((state) => state.setMobileNavOpen);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPortal>
        <DialogOverlay className="lg:hidden" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-hairline bg-white shadow-modal transition-transform duration-200 ease-out data-[state=closed]:-translate-x-full data-[state=open]:animate-slide-in-from-left lg:hidden"
          aria-label="Navigation"
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Choose a page to open.
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            aria-label="Close navigation"
            className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>

          <AppSidebar onNavigate={() => setOpen(false)} />
        </DialogPrimitive.Content>
      </DialogPortal>
    </DialogPrimitive.Root>
  );
}
