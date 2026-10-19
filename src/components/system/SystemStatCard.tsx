import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

interface SystemStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'forest' | 'accent' | 'sky' | 'amber' | 'slate';
}

const TONES: Record<NonNullable<SystemStatCardProps['tone']>, string> = {
  forest: 'bg-forest-50 text-forest-700',
  accent: 'bg-accent-200 text-forest-800',
  sky: 'bg-sky-100 text-sky-800',
  amber: 'bg-amber-100 text-amber-800',
  slate: 'bg-slate-100 text-slate-700',
};

export function SystemStatCard({ label, value, icon: Icon, hint, tone = 'forest' }: SystemStatCardProps) {
  return (
    <div className="rounded-2xl border border-hairline bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}
