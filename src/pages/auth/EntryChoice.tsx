import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogIn, UserPlus } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { type VerifiedOrganizationState } from '@/services/auth';

export function EntryChoice() {
  const navigate = useNavigate();
  const location = useLocation();
  const orgState = location.state as VerifiedOrganizationState | null;

  if (!orgState || !orgState.organization?.id || !orgState.accessKey) {
    return <Navigate to="/login" replace />;
  }

  const organization = orgState.organization;
  const needsApproval = organization.joinMode === 'approval';

  return (
    <AuthLayout
      title={organization.name}
      subtitle={
        needsApproval
          ? 'This organization reviews new members before granting access.'
          : 'Choose how you want to continue.'
      }
      footer={
        <>
          Wrong organization?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-semibold text-brand-700 hover:underline"
          >
            Use a different key
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <KeyRound className="size-4 text-brand-700" aria-hidden />
            Organization key verified
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Your key was checked for {organization.name}. Signing in still requires your email and
            password — the key alone never grants access.
          </p>
        </div>

        <Button
          type="button"
          className="w-full"
          onClick={() => navigate('/login/account', { state: orgState })}
        >
          <LogIn className="mr-2 size-4" aria-hidden />
          Log In
        </Button>

        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => navigate('/register', { state: orgState })}
        >
          <UserPlus className="mr-2 size-4" aria-hidden />
          Create Account
        </Button>
        <p className="text-center text-xs text-slate-500">
          {needsApproval
            ? 'New accounts are reviewed by an administrator before they can access farm data.'
            : 'New accounts join as a restricted member with the organization’s default role.'}
        </p>
      </div>
    </AuthLayout>
  );
}
