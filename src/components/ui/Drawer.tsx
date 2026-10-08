import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/utils/cn';

export const Drawer = Dialog;
export const DrawerTrigger = DialogPrimitive.Trigger;
export const DrawerClose = DialogPrimitive.Close;
export const DrawerTitle = DialogTitle;
export const DrawerDescription = DialogDescription;
export const DrawerOverlay = DialogOverlay;

export const DrawerContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DrawerOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-lg rounded-t-2xl border border-b-0 border-slate-200 bg-white p-5 shadow-modal',
        'data-[state=open]:animate-slide-in-from-bottom data-[state=closed]:translate-y-full',
        'transition-transform duration-200 ease-out',
        'max-h-[85dvh] overflow-y-auto',
        className,
      )}
      {...props}
    >
      <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-slate-200" aria-hidden />
      <DialogPrimitive.Close
        aria-label="Close"
        className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="size-4" aria-hidden />
      </DialogPrimitive.Close>
      {children}
    </DialogPrimitive.Content>
  </DialogPortal>
));

DrawerContent.displayName = 'DrawerContent';