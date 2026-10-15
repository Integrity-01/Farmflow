import { Sprout } from 'lucide-react';

const TAGLINE_WORDS = ['Track.', 'Advise.', 'Connect.', 'Grow.'];

export function BrandSplash({ message }: { message?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-brand-600 shadow-2xl shadow-brand-600/40">
        <Sprout className="size-9" aria-hidden />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">FarmFlow</h1>
      <p className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-semibold uppercase tracking-[0.3em] text-brand-300">
        {TAGLINE_WORDS.map((word) => (
          <span key={word}>{word}</span>
        ))}
      </p>
      <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
        <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
        <span>{message ?? 'Loading FarmFlow…'}</span>
      </div>
    </div>
  );
}
