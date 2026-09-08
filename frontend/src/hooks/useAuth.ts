import { useAuthContext } from '../app/providers';

export function useAuth() {
  const authContext = useAuthContext();

  return {
    ...authContext,
    role: authContext.user?.role || null,
  };
}

