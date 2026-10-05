import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';

export type UserRole = 'ADMIN' | 'DESIGN_ENGINEER' | 'STORE_CONTROLLER' | 'PRODUCTION_MGR';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  department: string;
}

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check local storage for existing session
    const token = localStorage.getItem('rm_access_token');
    const userStr = localStorage.getItem('rm_user');
    
    if (token && userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch (e) {
        localStorage.removeItem('rm_access_token');
        localStorage.removeItem('rm_user');
      }
    }
    
    setIsLoading(false);

    // Listen for unauthorized events from ApiClient interceptor
    const handleUnauthorized = () => {
      logout();
    };
    
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (credentials: any) => {
    try {
      const response = await authApi.login(credentials);
      
      localStorage.setItem('rm_access_token', response.token);
      localStorage.setItem('rm_user', JSON.stringify(response.user));
      
      setCurrentUser(response.user);
      
      // Navigate to default page based on role
      switch (response.user.role) {
        case 'DESIGN_ENGINEER':
          navigate('/governance/traceability'); // Example default
          break;
        case 'STORE_CONTROLLER':
          navigate('/dispatch/delivery-challan/type-1');
          break;
        case 'PRODUCTION_MGR':
          navigate('/governance/traceability');
          break;
        default:
          navigate('/');
      }
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('rm_access_token');
    localStorage.removeItem('rm_user');
    setCurrentUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout, isLoading }}>
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
