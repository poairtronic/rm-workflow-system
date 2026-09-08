import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/forms/FormField';
import { StatusAlert } from '../components/feedback/StatusAlert';
import { APP_CONFIG } from '../app/config';

const DEV_ACCOUNTS = [
  { name: 'System Admin', email: 'admin@airtronic.com', role: 'ADMIN' },
  { name: 'Rajesh Sharma (Design)', email: 'designer@airtronic.com', role: 'DESIGNER' },
  { name: 'Anil Kumar (Stores)', email: 'stores@airtronic.com', role: 'STORES' },
  { name: 'Suresh Patel (Production)', email: 'production@airtronic.com', role: 'PRODUCTION' },
  { name: 'Vikram Mehta (Senior Mgr)', email: 'senior.manager@airtronic.com', role: 'SENIOR_MANAGER' },
  { name: 'Dr. Arvind Swaminathan (GM)', email: 'general.manager@airtronic.com', role: 'GENERAL_MANAGER' },
];

export const LoginPage: React.FC = () => {
  const { login, devLogin, loading, error, clearError } = useAuth();
  const [email, setEmail] = useState('designer@airtronic.com');
  const [password, setPassword] = useState('Password@123');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await login(email, password);
    } catch {
      // Error state handled in context
    }
  };

  const handleSelectDevAccount = (selectedEmail: string) => {
    setEmail(selectedEmail);
    setPassword('Password@123');
    clearError();
  };

  const handleQuickDevToken = async (role: string) => {
    try {
      await devLogin(role);
    } catch {
      // Error state handled in context
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="login-header">
          <div className="brand-pill">{APP_CONFIG.appName}</div>
          <h1 className="login-title">{APP_CONFIG.appTitle}</h1>
          <p className="login-subtitle">
            Internal Manufacturing Raw-Material Workflow & Traceability Portal
          </p>
        </div>

        <Card title="Account Authentication" subtitle="Sign in with your enterprise credentials">
          <form onSubmit={handleSubmit} className="login-form">
            {error && <StatusAlert type="error" title="Authentication Failed" message={error} />}

            <FormField label="Enterprise Email Address" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError();
                }}
                placeholder="user@airtronic.com"
                className="input"
                disabled={loading}
              />
            </FormField>

            <FormField label="Password" required>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  clearError();
                }}
                placeholder="••••••••••••"
                className="input"
                disabled={loading}
              />
            </FormField>

            <div className="form-actions">
              <Button type="submit" variant="primary" disabled={loading} className="w-full">
                {loading ? 'Authenticating...' : 'Sign In to Workspace'}
              </Button>
            </div>
          </form>

          <div className="dev-accounts-panel">
            <h4 className="dev-subtitle">Development Fast-Fill Accounts</h4>
            <div className="dev-account-buttons">
              {DEV_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleSelectDevAccount(acc.email)}
                  className="dev-account-chip"
                >

                    {acc.name} ({acc.role})

                </button>
              ))}
            </div>
            <div className="dev-quick-token">
              <span className="text-xs text-muted">Dev Token Bypass: </span>
              {['ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleQuickDevToken(r)}
                  className="btn-link-xs"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
