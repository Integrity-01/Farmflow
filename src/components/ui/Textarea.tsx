import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors',
        'placeholder:text-slate-400',
        'hover:border-slate-400',
        'focus-visible:border-brand-500',
        'disabled:cursor-not-allowed disabled:opacity-60',
        'aria-[invalid=true]:border-red-500',
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';