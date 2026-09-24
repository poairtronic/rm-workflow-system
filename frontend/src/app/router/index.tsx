import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import LoginPage from '../../pages/LoginPage';
import DashboardPage from '../../pages/DashboardPage';
import { InventoryPage } from '../../pages/InventoryPage';
import { MasterDataPage } from '../../pages/MasterDataPage';
import WorkflowPage from '../../pages/WorkflowPage';
import { NotificationSettingsPage } from '../../pages/NotificationSettingsPage';
import { EmailObservabilityPage } from '../../pages/EmailObservabilityPage';
import { AppLayout } from '../../layouts/AppLayout';

export type CurrentView =
  | 'dashboard'
  | 'master-data'
  | 'design-rm'
  | 'stores'
  | 'production'
  | 'sc-completion'
  | 'monitoring'
  | 'inventory'
  | 'analytics'
  | 'admin'
  | 'notifications-settings'
  | 'email-observability';

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
      {currentView === 'inventory' ? (
        <InventoryPage currentView={currentView} onNavigate={setCurrentView} />
      ) : currentView === 'master-data' ? (
        <AppLayout activeNav={currentView} onNavigate={(nav) => setCurrentView(nav as CurrentView)}>
          <MasterDataPage />
        </AppLayout>
      ) : currentView === 'notifications-settings' ? (
        <AppLayout activeNav={currentView} onNavigate={(nav) => setCurrentView(nav as CurrentView)}>
          <NotificationSettingsPage />
        </AppLayout>
      ) : currentView === 'email-observability' ? (
        <AppLayout activeNav={currentView} onNavigate={(nav) => setCurrentView(nav as CurrentView)}>
          <EmailObservabilityPage />
        </AppLayout>
      ) : ['design-rm', 'stores', 'production', 'sc-completion', 'monitoring'].includes(currentView) ? (
        <WorkflowPage currentView={currentView} onNavigate={(nav) => setCurrentView(nav as CurrentView)} />
      ) : (
        <DashboardPage currentView={currentView} onNavigate={setCurrentView} />
      )}
    </div>
  );
}

