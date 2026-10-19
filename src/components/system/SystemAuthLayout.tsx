import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';

interface SystemAuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SystemAuthLayout({ title, subtitle, children, footer }: SystemAuthLayoutProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-forest-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-400 text-forest-950 shadow-glass">
            <ShieldCheck className="size-8" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-forest-100/70">{subtitle}</p> : null}
        </div>
        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-lift">{children}</div>
        {footer ? <div className="mt-5 text-center text-sm text-forest-100/80">{footer}</div> : null}
      </div>
    </div>
  );
}
