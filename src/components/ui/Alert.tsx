import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/utils/cn';

const alertVariants = cva('flex items-start gap-3 rounded-xl border p-4 text-sm', {
  variants: {
    variant: {
      default: 'border-slate-200 bg-white text-slate-700',
      info: 'border-sky-200 bg-sky-50 text-sky-900',
      success: 'border-brand-200 bg-brand-50 text-brand-900',
      warning: 'border-amber-200 bg-amber-50 text-amber-900',
      danger: 'border-red-200 bg-red-50 text-red-900',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const variantIcons: Record<NonNullable<VariantProps<typeof alertVariants>['variant']>, LucideIcon> = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: LucideIcon | false;
}

export function Alert({ className, variant = 'default', icon, children, ...props }: AlertProps) {
  const Icon = icon === false ? null : (icon ?? variantIcons[variant ?? 'default']);
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      {Icon ? <Icon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
      <div className="flex-1 space-y-1">{children}</div>
    </div>
  );
}

export function AlertTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('font-semibold', className)}>{children}</p>;
}

export function AlertDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('text-sm opacity-90', className)}>{children}</p>;
}