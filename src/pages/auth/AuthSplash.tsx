import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, KeyRound, Sprout } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi, type VerifiedOrganizationState } from '@/services/auth';

export function AuthSplash() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!accessKey.trim()) {
      setError('Enter your organization key to continue.');
      return;
    }

    setSubmitting(true);
    try {
      const organization = await authApi.verifyOrganizationKey(accessKey.trim());
      const state: VerifiedOrganizationState = {
        organization,
        accessKey: accessKey.trim(),
        next: searchParams.get('next') ?? undefined,
      };
      navigate('/login/choice', { state });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to verify this key. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
        <Link to="/login" className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Sprout className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">FarmFlow</span>
        </Link>
      </header>

      <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-12 px-5 py-12 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="max-w-2xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800">
            <Sprout className="size-4" aria-hidden />
            Farm work, flowing together
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Your people. Your fields.{' '}
            <span className="text-brand-700">One clear view.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Sign in to your farm organization to coordinate teams, track field work, and keep every
            season moving.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.35em] text-brand-700">
            Track. Advise. Connect. Grow.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-slate-600">
            <span className="rounded-full border border-slate-200 px-3 py-2">Tasks &amp; teams</span>
            <span className="rounded-full border border-slate-200 px-3 py-2">Fields &amp; harvests</span>
            <span className="rounded-full border border-slate-200 px-3 py-2">Progress in one place</span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <KeyRound className="size-6" aria-hidden />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Enter your organization</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Use the key shared by your organization administrator. We’ll verify it before you sign
            in or create an account.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {error ? (
              <Alert variant="danger">
                <AlertTitle>Key verification failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <FormField id="organization-key" label="Organization key" required>
              <Input
                id="organization-key"
                type="password"
                autoComplete="off"
                placeholder="Paste your organization key"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
              />
            </FormField>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Verifying key…' : 'Continue'}
              {!submitting ? <ArrowRight className="ml-2 size-4" aria-hidden /> : null}
            </Button>
          </form>

          <div className="my-6 border-t border-slate-100" />
          <p className="text-center text-sm text-slate-600">
            Setting up a new team?{' '}
            <Link to="/new-organization" className="font-semibold text-brand-700 hover:underline">
              Create an organization
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
