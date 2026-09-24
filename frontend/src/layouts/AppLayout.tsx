import React from 'react';
import { APP_CONFIG } from '../app/config';
import { useAuth } from '../hooks/useAuth';
import { ROLE_DISPLAY_NAMES } from '../constants/roles';
import { Button } from '../components/ui/Button';

interface AppLayoutProps {
  children: React.ReactNode;
  activeNav?: string;
  onNavigate?: (nav: string) => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  activeNav = 'dashboard',
  onNavigate,
}) => {
  const { user, role, logout } = useAuth();

  // Role-based navigation rules
  const getNavItems = () => {
    const baseItems = [
      { id: 'dashboard', label: 'Overview & Health' },
      { id: 'inventory', label: 'Inventory' },
      { id: 'notifications-settings', label: 'Notifications & Alerts' },
    ];

    switch (role) {
      case 'DESIGNER':
        return [
          ...baseItems,
          { id: 'design-rm', label: 'Design RM List' },
        ];
      case 'STORES':
        return [
          ...baseItems,
          { id: 'stores', label: 'Stores Workspace' },
        ];
      case 'PRODUCTION':
        return [
          ...baseItems,
          { id: 'production', label: 'Production Traceability' },
          { id: 'sc-completion', label: 'SC Completion' },
        ];
      case 'SENIOR_MANAGER':
      case 'GENERAL_MANAGER':
        return [
          ...baseItems,
          { id: 'monitoring', label: 'Operations Monitoring' },
          { id: 'analytics', label: 'Analytics' },
        ];
      case 'ADMIN':
      default:
        return [
          ...baseItems,
          { id: 'master-data', label: 'Master Data' },
          { id: 'design-rm', label: 'Design RM List' },
          { id: 'stores', label: 'Stores Workspace' },
          { id: 'production', label: 'Production Traceability' },
          { id: 'sc-completion', label: 'SC Completion' },
          { id: 'email-observability', label: 'Email Queue Health' },
          { id: 'admin', label: 'Administration' },
        ];
    }
  };

  const navItems = getNavItems();
  const roleDisplay = role ? ROLE_DISPLAY_NAMES[role] || role : 'User';

  return (
    <div className="app-layout">
      <header className="top-header">
        <div className="header-brand">
          <span className="brand-badge">{APP_CONFIG.appName}</span>
          <span className="brand-title">{APP_CONFIG.appTitle}</span>
        </div>
        
        {user && (
          <div className="header-user-meta">
            <div className="user-info">
              <span className="user-name">{user.name || user.email}</span>
              <span className="user-role-badge">{roleDisplay}</span>
            </div>
            <Button onClick={logout} variant="secondary" size="sm">
              Sign Out
            </Button>

          </div>
        )}
      </header>

      <nav className="subnav-bar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate?.(item.id)}
            className={`subnav-link ${activeNav === item.id ? 'active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="layout-body">{children}</main>
    </div>
  );
};

