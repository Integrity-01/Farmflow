import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export const Separator = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      className={cn('h-px w-full shrink-0 bg-slate-200', className)}
      {...props}
    />
  ),
);

Separator.displayName = 'Separator';