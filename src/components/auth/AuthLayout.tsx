import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="flex h-16 items-center px-4 sm:px-6">
        <Link to="/login" className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Sprout className="size-5" aria-hidden />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">FarmFlow</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            {children}
          </div>
          {footer ? <p className="mt-6 text-center text-sm text-slate-500">{footer}</p> : null}
        </div>
      </main>
    </div>
  );
}