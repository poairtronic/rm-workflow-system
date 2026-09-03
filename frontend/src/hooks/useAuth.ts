import { useState, useEffect } from 'react';
import { AuthService, type AuthRolesResponse } from '../services/auth.service';

export function useAuth() {
  const [roles, setRoles] = useState<AuthRolesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AuthService.getRoles()
      .then(setRoles)
      .catch((err) => setError(err.message));
  }, []);

  return { roles, loading, error, setLoading };
}
