import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoginPage from '../../pages/LoginPage';
import DashboardPage from '../../pages/DashboardPage';

export type CurrentView =
  | 'dashboard'
  | 'design-rm'
  | 'stores'
  | 'production'
  | 'sc-completion'
  | 'monitoring'
  | 'analytics'
  | 'admin';

export function AppRouter() {
  const { isAuthenticated, loading } = useAuth();
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');

  if (loading) {
    return (
      <div className="flex-center p-8 text-center">
        <div className="badge badge-warning">Loading Workspace Context...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="router-container">
      <DashboardPage currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
}

