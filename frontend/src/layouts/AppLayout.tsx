import React from 'react';
import { APP_CONFIG } from '../app/config';

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
  const navItems = [
    { id: 'dashboard', label: 'Overview & Health' },
    { id: 'design-rm', label: 'Design RM List' },
    { id: 'stores', label: 'Stores Material Issue' },
    { id: 'production', label: 'Production Traceability' },
    { id: 'sc-completion', label: 'SC Completion' },
  ];

  return (
    <div className="app-layout">
      <header className="top-header">
        <div className="header-brand">
          <span className="brand-badge">{APP_CONFIG.appName}</span>
          <span className="brand-title">{APP_CONFIG.appTitle}</span>
        </div>
        <div className="header-meta">
          <span className="system-pill">Phase 4 Verified</span>
        </div>
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
