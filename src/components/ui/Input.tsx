import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[10px] border border-neutral-300 bg-white px-3.5 text-sm text-neutral-950 shadow-sm transition-colors',
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

Input.displayName = 'Input';