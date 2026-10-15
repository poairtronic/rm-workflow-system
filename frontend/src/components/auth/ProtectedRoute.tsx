import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

import { isPathAllowedForUser } from '../../routeConfig';

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
    const fromPath =
      location.pathname === '/unauthorized' || location.pathname === '/login'
        ? undefined
        : location.pathname;
    return <Navigate to="/login" state={fromPath ? { from: fromPath } : undefined} replace />;
  }

  if (currentUser.role === 'ADMIN') {
    return children ? <>{children}</> : <Outlet />;
  }

  // Check canonical route permission logic
  if (!isPathAllowedForUser(location.pathname, currentUser)) {
    // If not matching canonical path directly (e.g. dynamic param routes or wrappers), test fallback props
    const roleMatches = allowedRoles && allowedRoles.includes(currentUser.role as UserRole);
    const moduleMatches = moduleKey && currentUser.effectiveModules && currentUser.effectiveModules.includes(moduleKey);
    if (!roleMatches && !moduleMatches) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
}
