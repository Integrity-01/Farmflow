import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-neutral-100 text-neutral-700',
        success: 'bg-brand-100 text-brand-700',
        lime: 'bg-accent-100 text-brand-600',
        warning: 'bg-orange-100 text-orange-900',
        orange: 'bg-orange-100 text-orange-900',
        danger: 'bg-red-100 text-red-700',
        info: 'bg-brand-50 text-brand-700',
        neutral: 'bg-neutral-100 text-neutral-700',
        outline: 'border border-neutral-300 text-neutral-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}