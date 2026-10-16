import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Sprout, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/utils/cn';

const highlights = [
  { icon: Users, label: 'Tasks & teams' },
  { icon: Sprout, label: 'Fields & harvests' },
  { icon: TrendingUp, label: 'Progress in one place' },
] as const;

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  eyebrow,
  contentClassName,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  eyebrow?: string;
  contentClassName?: string;
}) {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-forest-900 lg:block">
        <img
          src="/images/farm-hero.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover"
          decoding="async"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-forest-950/55 via-forest-950/30 to-forest-950/80"
          aria-hidden
        />
        <div className="sticky top-0 flex h-dvh flex-col justify-between p-10">
          <Link to="/login" className="relative z-10 flex items-center gap-2 text-white">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-400 text-forest-900 shadow-soft">
              <Sprout className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">FarmFlow</span>
          </Link>

          <div className="relative z-10 max-w-md">
            <p className="text-xs font-semibold uppercase tracking-[0.45em] text-accent-300">
              FarmFlow
            </p>
            <h2 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white">
              Farm work, flowing together
            </h2>
            <p className="mt-3 text-lg font-medium text-accent-200">
              Your people. Your fields. One clear view.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/75">
              Sign in to your farm organization to coordinate teams, track field work, and keep every
              season moving.
            </p>
            <ul className="mt-7 flex flex-wrap gap-2.5">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="glass-dark flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium text-white"
                  >
                    <Icon className="size-3.5 text-accent-300" aria-hidden />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="relative z-10 text-xs font-semibold uppercase tracking-[0.35em] text-accent-300">
            Track. Advise. Connect. Grow.
          </p>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="flex h-16 items-center px-5 sm:px-8 lg:hidden">
          <Link to="/login" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Sprout className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">FarmFlow</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-14 pt-2 sm:px-8">
          <div className={cn('animate-fade-in w-full max-w-md', contentClassName)}>
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-700">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-forest-900 sm:text-3xl">
              {title}
            </h1>
            {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
            <div className="glass-panel mt-6 rounded-3xl p-6 sm:p-7">{children}</div>
            {footer ? <div className="mt-6 text-center text-sm text-muted">{footer}</div> : null}
          </div>
        </main>
      </div>
    </div>
  );
}
