import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { AuthUser } from '../../types/auth';
import { AuthService } from '../../services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'rm_access_token';
const USER_KEY = 'rm_auth_user';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    let storedUser = null;
    try {
      const raw = localStorage.getItem('rm_auth_user');
      if (raw) storedUser = JSON.parse(raw);
    } catch {
      localStorage.removeItem('rm_auth_user');
    }
    return storedUser;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  // Restore profile or validate token on initial mount
  useEffect(() => {
    const existingToken = localStorage.getItem(TOKEN_KEY);
    const existingUser = localStorage.getItem(USER_KEY);
    if (existingToken && !existingUser) {
      AuthService.getProfile()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          }
        })
        .catch(() => {
          logout();
        });
    }
  }, [logout]);

  const login = useCallback(async (email: string, pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await AuthService.login(email, pass);
      setToken(res.accessToken);
      setUser(res.user);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch (err: any) {
      const msg = err.message || 'Login failed. Check credentials.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const contextValue = useMemo(() => ({
    user,
    token,
    isAuthenticated: Boolean(token),
    loading,
    error,
    login,
    logout,
    clearError,
  }), [user, token, loading, error, login, logout, clearError]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AppProviders');
  }
  return context;
}

