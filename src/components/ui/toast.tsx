import * as ToastPrimitives from '@radix-ui/react-toast';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/utils/cn';

export const ToastProvider = ToastPrimitives.Provider;

const toastVariants = cva(
  'group pointer-events-auto relative flex w-full items-start justify-between gap-3 overflow-hidden rounded-xl border bg-white p-4 pl-5 text-slate-900 shadow-modal',
  {
    variants: {
      variant: {
        default: 'border-slate-200',
        success: 'border-brand-200',
        info: 'border-sky-200',
        warning: 'border-amber-200',
        danger: 'border-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

const barColors: Record<NonNullable<VariantProps<typeof toastVariants>['variant']>, string> = {
  default: 'bg-slate-300',
  success: 'bg-brand-500',
  info: 'bg-sky-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
};

export interface ToastProps
  extends ComponentPropsWithoutRef<typeof ToastPrimitives.Root>,
    VariantProps<typeof toastVariants> {}

export const Toast = forwardRef<ElementRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant, ...props }, ref) => (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        toastVariants({ variant }),
        'data-[state=open]:animate-slide-in-from-right data-[state=closed]:animate-slide-out-to-right',
        'data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
        className,
      )}
      {...props}
    >
      <span
        className={cn('absolute inset-y-0 left-0 w-1', (barColors as Record<string, string>)[variant ?? 'default'])}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-1">{props.children}</div>
      <ToastPrimitives.Close
        aria-label="Dismiss"
        className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
      >
        <X className="size-3.5" aria-hidden />
      </ToastPrimitives.Close>
    </ToastPrimitives.Root>
  ),
);

Toast.displayName = ToastPrimitives.Root.displayName;

export const ToastTitle = forwardRef<
  ElementRef<typeof ToastPrimitives.Title>,
  ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn('pr-5 text-sm font-semibold', className)}
    {...props}
  />
));

ToastTitle.displayName = ToastPrimitives.Title.displayName;

export const ToastDescription = forwardRef<
  ElementRef<typeof ToastPrimitives.Description>,
  ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm text-slate-500', className)}
    {...props}
  />
));

ToastDescription.displayName = ToastPrimitives.Description.displayName;

export const ToastViewport = forwardRef<
  ElementRef<typeof ToastPrimitives.Viewport>,
  ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed inset-x-0 bottom-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:bottom-4 sm:right-4 sm:top-auto sm:left-auto sm:max-w-[420px] sm:flex-col',
      className,
    )}
    {...props}
  />
));

ToastViewport.displayName = ToastPrimitives.Viewport.displayName;