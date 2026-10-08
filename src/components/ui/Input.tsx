import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 shadow-sm transition-colors',
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

Input.displayName = 'Input';