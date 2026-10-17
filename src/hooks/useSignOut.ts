import { useNavigate } from 'react-router-dom';
import { authApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth.store';
import { useToastStore } from '@/store/toast.store';

/**
 * Shared sign-out flow used by the sidebar footer and the top bar account menu.
 * Clears the local session even if the network call fails.
 */
export function useSignOut() {
  const navigate = useNavigate();

  return async function signOut() {
    try {
      await authApi.logout();
    } catch {
      // still clear the local session even if the network call fails
    }
    useAuthStore.getState().clearSession();
    useToastStore.getState().add({
      title: 'Signed out',
      description: 'You have been signed out of FarmFlow.',
    });
    navigate('/login', { replace: true });
  };
}
