import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

export type UserRole = 'ADMIN' | 'DESIGNER' | 'STORES' | 'PRODUCTION' | 'SENIOR_MANAGER' | 'GENERAL_MANAGER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department?: string;
}

interface AuthContextType {
  currentUser: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('rm_access_token'));
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('rm_access_token');
      if (storedToken) {
        try {
          const res = await authApi.getMe();
          setCurrentUser(res.user);
          setToken(storedToken);
        } catch (e: any) {
          localStorage.removeItem('rm_access_token');
          setCurrentUser(null);
          setToken(null);
          // Network / backend down - show toast but don't crash
          if (!e?.response || e?.code === 'ERR_NETWORK' || e?.code === 'ECONNREFUSED') {
            toast.error('Backend unavailable – please start the server.', { duration: 5000 });
          }
        }
      }
      setIsLoading(false);
    };

    initializeAuth();

    const handleUnauthorized = () => {
      toast.error('Session expired');
      localStorage.removeItem('rm_access_token');
      setCurrentUser(null);
      setToken(null);
      navigate('/login');
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [navigate]); // exclude location.pathname to avoid re-running

  const login = async (credentials: any) => {
    try {
      const response = await authApi.login(credentials);
      
      localStorage.setItem('rm_access_token', response.token);
      setCurrentUser(response.user);
      setToken(response.token);
      
    } catch (err: any) {
      if (!err?.response || err?.code === 'ERR_NETWORK') {
        toast.error('Cannot reach the server. Is the backend running?', { duration: 5000 });
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('rm_access_token');
    setCurrentUser(null);
    setToken(null);
    navigate('/login');
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, token, isAuthenticated: !!currentUser, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
