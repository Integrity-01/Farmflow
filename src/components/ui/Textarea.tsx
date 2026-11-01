import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-950 shadow-sm transition-colors',
        'placeholder:text-neutral-400',
        'hover:border-neutral-400',
        'focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25',
        'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-60',
        'aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus-visible:ring-red-500/25',
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';