import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, KeyRound } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/services/api';
import { authApi } from '@/services/auth';
import { organizationApi } from '@/services/organization';
import { useAuthStore } from '@/store/auth.store';

type Phase = 'idle' | 'working' | 'success' | 'error';

export function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [accessKey, setAccessKey] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    setPhase('working');

    void (async () => {
      try {
        await organizationApi.acceptInvitation(token);
        const user = await authApi.me();
        useAuthStore.getState().setUser(user);
        setMessage(user.currentOrg?.name ? `You now have access to ${user.currentOrg.name}.` : 'Invitation accepted.');
        setPhase('success');
        setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
      } catch (error) {
        setMessage(error instanceof ApiError ? error.message : 'We could not accept this invitation.');
        setPhase('error');
      }
    })();
  }, [token, navigate]);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    setJoinError(null);

    if (!accessKey.trim()) {
      setJoinError('Please enter an access key.');
      return;
    }

    setJoinBusy(true);
    try {
      await organizationApi.join(accessKey.trim());
      const user = await authApi.me();
      useAuthStore.getState().setUser(user);
      const org = user.orgs?.find((item) => item.status === 'pending');
      setPending(true);
      setMessage(
        org
          ? `Your request to join ${org.name} was sent. An administrator will approve it shortly.`
          : 'Your request to join was sent. An administrator will approve it shortly.',
      );
    } catch (error) {
      setJoinError(error instanceof ApiError ? error.message : 'We could not use that access key.');
    } finally {
      setJoinBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-slate-900">
            {token ? 'Accept your invitation' : 'Join an organization'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {token ? (
            phase === 'working' ? (
              <Alert variant="info">
                <AlertTitle>Accepting invitation…</AlertTitle>
                <AlertDescription>This will only take a moment.</AlertDescription>
              </Alert>
            ) : phase === 'success' ? (
              <Alert variant="success">
                <AlertTitle>You're in</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            ) : (
              <Alert variant="danger">
                <AlertTitle>Could not accept invitation</AlertTitle>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )
          ) : pending ? (
            <Alert variant="success">
              <AlertTitle>Request sent</AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-slate-500">
                Enter the access key an administrator shared with you. You will be added as a
                field officer and an administrator must approve you before you can access data.
              </p>
              {joinError ? (
                <Alert variant="danger">
                  <AlertTitle>Could not join</AlertTitle>
                  <AlertDescription>{joinError}</AlertDescription>
                </Alert>
              ) : null}
              <form onSubmit={handleJoin} className="space-y-4" noValidate>
                <FormField id="access-key" label="Access key" required>
                  <Input
                    id="access-key"
                    placeholder="Paste your access key"
                    value={accessKey}
                    onChange={(event) => setAccessKey(event.target.value)}
                  />
                </FormField>
                <Button type="submit" className="w-full" loading={joinBusy}>
                  <KeyRound className="size-4" aria-hidden />
                  Join organization
                </Button>
              </form>
            </>
          )}

          {phase !== 'working' && !pending ? (
            <div className="pt-1 text-center">
              {phase === 'success' ? (
                <Button asChild variant="outline" className="w-full">
                  <Link to="/dashboard">
                    <MailCheck className="size-4" aria-hidden />
                    Go to dashboard
                  </Link>
                </Button>
              ) : (
                <Link to="/dashboard" className="text-sm font-medium text-brand-700 hover:underline">
                  {phase === 'error' ? 'Back to dashboard' : 'Skip for now'}
                </Link>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
