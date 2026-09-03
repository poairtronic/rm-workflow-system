import React from 'react';
import { APP_CONFIG } from '../app/config';

export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <div className="auth-header">
          <span className="brand-badge">{APP_CONFIG.appName}</span>
          <h1 className="auth-title">Authentication</h1>
        </div>
        {children}
      </div>
    </div>
  );
};
