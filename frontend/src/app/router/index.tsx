import { useState } from 'react';
import DashboardPage from '../../pages/DashboardPage';

export type CurrentView =
  'dashboard' | 'design-rm' | 'stores' | 'production' | 'sc-completion';

export function AppRouter() {
  const [currentView, setCurrentView] = useState<CurrentView>('dashboard');

  return (
    <div className="router-container">
      <DashboardPage currentView={currentView} onNavigate={setCurrentView} />
    </div>
  );
}
