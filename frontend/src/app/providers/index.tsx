import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser } from '../../types/auth';
import { AuthService } from '../../services/auth.service';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  devLogin: (role?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'rm_access_token';
const USER_KEY = 'rm_auth_user';

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const savedUser = localStorage.getItem(USER_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(TOKEN_KEY);
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const logout = () => {
    setToken(null);
    setUser(null);
    setError(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

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
  }, []);

  const login = async (email: string, pass: string) => {
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
  };

  const devLogin = async (role?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await AuthService.getDevToken(role);
      setToken(res.accessToken);
      setUser(res.user);
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    } catch (err: any) {
      const msg = err.message || 'Dev login failed.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);


  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token),
        loading,
        error,
        login,
        devLogin,
        logout,
        clearError,
      }}
    >
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

