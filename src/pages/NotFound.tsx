import { Link } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Sprout className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-slate-900">Nothing growing here.</h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link to="/" className="mt-6">
        <Button size="lg">Back to Dashboard</Button>
      </Link>
    </div>
  );
}