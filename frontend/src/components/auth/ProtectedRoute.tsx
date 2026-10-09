import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
  moduleKey?: string;
  children?: ReactNode;
}

export function ProtectedRoute({ allowedRoles, moduleKey, children }: ProtectedRouteProps) {
  const { isAuthenticated, currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (currentUser.role === 'ADMIN') {
    return children ? <>{children}</> : <Outlet />;
  }

  if (moduleKey && currentUser.effectiveModules) {
    if (!currentUser.effectiveModules.includes(moduleKey)) {
      return <Navigate to="/unauthorized" replace />;
    }
  } else if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
