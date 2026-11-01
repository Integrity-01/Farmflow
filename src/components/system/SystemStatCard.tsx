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
  forest: 'bg-brand-50 text-brand-700',
  accent: 'bg-accent-100 text-brand-600',
  sky: 'bg-brand-50 text-brand-700',
  amber: 'bg-orange-50 text-orange-700',
  slate: 'bg-neutral-100 text-neutral-600',
};

export function SystemStatCard({ label, value, icon: Icon, hint, tone = 'forest' }: SystemStatCardProps) {
  return (
    <div className="rounded-[14px] border border-neutral-200 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-neutral-950 tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', TONES[tone])}>
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}
