// src/hooks/useSession.ts
import { useSession as useNextAuthSession } from 'next-auth/react';
import { Role } from '@/lib/auth/roles';

export function useSession() {
  const { data: session, status, update } = useNextAuthSession();

  return {
    session,
    status,
    update,
    user: session?.user,
    role: session?.user?.role as Role | undefined,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
  };
}

export function useRequireAuth(redirectTo = '/login') {
  const { isAuthenticated, isLoading } = useSession();

  return { isAuthenticated, isLoading, shouldRedirect: !isLoading && !isAuthenticated, redirectTo };
}
