import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Sprout, TrendingUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

const highlights = [
  { icon: Users, label: 'Tasks & teams' },
  { icon: Sprout, label: 'Fields & harvests' },
  { icon: TrendingUp, label: 'Progress in one place' },
] as const;

export function Splash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  function proceed() {
    const query = next ? `?next=${encodeURIComponent(next)}` : '';
    navigate(`/login/welcome${query}`);
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-forest-900">
      <img
        src="/images/farm-hero.svg"
        alt="Sunrise over rolling farmland with rows of crops and a drone flying above"
        className="pointer-events-none absolute inset-0 size-full object-cover"
        fetchPriority="high"
        decoding="async"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-forest-950/55 via-forest-950/35 to-forest-950/80"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-forest-950/60 via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="safe-area-top flex h-16 items-center px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 text-white">
            <span className="flex size-9 items-center justify-center rounded-xl bg-accent-400 text-forest-900 shadow-soft">
              <Sprout className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-bold tracking-tight">FarmFlow</span>
          </Link>
        </header>

        <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
          <section className="max-w-2xl">
            <p className="animate-rise-in text-xs font-semibold uppercase tracking-[0.45em] text-accent-300">
              FarmFlow
            </p>
            <h1
              className="animate-rise-in mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
              style={{ animationDelay: '80ms' }}
            >
              Farm work, flowing together
            </h1>
            <p
              className="animate-rise-in mt-5 text-xl font-medium text-accent-200 sm:text-2xl"
              style={{ animationDelay: '160ms' }}
            >
              Your people. Your fields. One clear view.
            </p>
            <p
              className="animate-rise-in mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg"
              style={{ animationDelay: '240ms' }}
            >
              Sign in to your farm organization to coordinate teams, track field work, and keep every
              season moving.
            </p>
            <p
              className="animate-rise-in mt-6 text-xs font-semibold uppercase tracking-[0.35em] text-accent-300"
              style={{ animationDelay: '320ms' }}
            >
              Track. Advise. Connect. Grow.
            </p>

            <ul
              className="animate-rise-in mt-8 hidden flex-wrap gap-3 sm:flex"
              style={{ animationDelay: '400ms' }}
            >
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.label}
                    className="glass-dark flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white"
                  >
                    <Icon className="size-4 text-accent-300" aria-hidden />
                    {item.label}
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className="animate-rise-in mx-auto w-full max-w-md"
            style={{ animationDelay: '260ms' }}
          >
            <div className="glass-dark rounded-3xl p-6 sm:p-8">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-400 text-forest-900">
                <Sprout className="size-6" aria-hidden />
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-white">
                Ready when you are
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Continue to choose how you sign in — as an administrator, as a team member, or by
                creating a new organization.
              </p>

              <ul className="mt-6 space-y-2.5">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.label} className="flex items-center gap-3 text-sm text-white/90">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-white/12 text-accent-300">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      {item.label}
                    </li>
                  );
                })}
              </ul>

              <Button
                variant="lime"
                size="lg"
                className="mt-7 w-full"
                onClick={proceed}
              >
                Proceed
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <p className={cn('mt-4 text-center text-xs text-white/60')}>
                Secure sign-in for every member of your farm organization.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
