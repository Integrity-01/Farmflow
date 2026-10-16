import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Building2, ShieldCheck, Users } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';

const options = [
  {
    key: 'admin',
    title: 'Login as Admin',
    description: 'Use your Admin ID and password to manage an organization.',
    icon: ShieldCheck,
    to: '/login/admin',
  },
  {
    key: 'user',
    title: 'Login as User',
    description: 'Enter your organization key to sign in or join your team.',
    icon: Users,
    to: '/login/user',
  },
  {
    key: 'create',
    title: 'Create New Organization',
    description: 'Set up a new team and become its first administrator.',
    icon: Building2,
    to: '/new-organization',
  },
] as const;

export function Welcome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');

  function go(to: string) {
    const query = next ? `?next=${encodeURIComponent(next)}` : '';
    navigate(`${to}${query}`);
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Welcome to FarmFlow"
      subtitle="Choose how you want to continue."
      footer="Secure access for administrators, field teams, and new organizations."
    >
      <div className="space-y-3">
        {options.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => go(option.to)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-hairline bg-white/70 p-4 text-left transition hover:border-accent-400 hover:bg-accent-200/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700 transition group-hover:bg-accent-300 group-hover:text-forest-900">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-forest-900">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-muted">
                  {option.description}
                </span>
              </span>
              <ArrowRight
                className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
                aria-hidden
              />
            </button>
          );
        })}
      </div>
    </AuthLayout>
  );
}
