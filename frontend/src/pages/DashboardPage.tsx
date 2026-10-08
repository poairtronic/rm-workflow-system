import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusAlert } from '../components/feedback/StatusAlert';
import { WorkflowProgress } from '../components/workflow/WorkflowProgress';
import { APP_CONFIG } from '../app/config';

import { DesignerDashboard } from '../components/dashboards/DesignerDashboard';
import { StoresDashboard } from '../components/dashboards/StoresDashboard';
import { ProductionDashboard } from '../components/dashboards/ProductionDashboard';
import { ManagementDashboard } from '../components/dashboards/ManagementDashboard';

interface DashboardPageProps {
  currentView?: string;
  onNavigate?: (view: any) => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  currentView = 'dashboard',
  onNavigate,
}) => {
  const { health, loading, error, lastChecked, refetch } = useHealth();
  const { role } = useAuth();

  const operationalRoles = ['ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION'];
  const governanceRoles = ['SENIOR_MANAGER', 'GENERAL_MANAGER'];

  const renderRoleDashboard = () => {
    switch (role) {
      case 'DESIGNER':
        return <DesignerDashboard />;
      case 'STORES':
        return <StoresDashboard />;
      case 'PRODUCTION':
        return <ProductionDashboard />;
      case 'SENIOR_MANAGER':
      case 'GENERAL_MANAGER':
        return <ManagementDashboard />;
      case 'ADMIN':
        return (
          <div className="space-y-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-700">Admin Meta-Dashboard Overview</h3>
            <DesignerDashboard />
            <StoresDashboard />
            <ProductionDashboard />
            <ManagementDashboard />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AppLayout activeNav={currentView} onNavigate={onNavigate}>
      <div className="page-container">
        
        {renderRoleDashboard()}

        <Card
          title="Manufacturing Workflow Progression"
          subtitle="Real-time status progression from Design through Stores, Production, and Closure"
        >
          <WorkflowProgress currentStepIndex={0} />
        </Card>

        <Card
          title="Backend Connectivity & API Diagnostics"
          subtitle={`Targeting NestJS API at ${APP_CONFIG.apiBaseUrl}`}
          action={
            <Button onClick={refetch} disabled={loading} variant="primary" size="sm">
              {loading ? 'Checking...' : 'Re-test Health'}
            </Button>
          }
          className="border-primary"
        >
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Health Endpoint</span>
              <code className="status-code">{APP_CONFIG.healthEndpoint}</code>
            </div>
            <div className="status-item">
              <span className="status-label">Service Status</span>
              {loading ? (
                <span className="badge badge-warning">Probing...</span>
              ) : error ? (
                <span className="badge badge-error">Offline</span>
              ) : (
                <span className="badge badge-success">Active ({health?.status})</span>
              )}
            </div>
            <div className="status-item">
              <span className="status-label">Service Name</span>
              <span className="status-value">{health?.service || '?'}</span>
            </div>
            <div className="status-item">
              <span className="status-label">Last Ping</span>
              <span className="status-value">{lastChecked || 'Pending'}</span>
            </div>
          </div>

          {error && (
            <StatusAlert
              type="error"
              title="Connection Failure"
              message={error}
              hint="Ensure backend server is running on port 3000 via npm run start:dev."
            />
          )}

          {health && (
            <div className="response-box">
              <span className="response-label">API Health JSON:</span>
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
        </Card>

        <div className="two-col-grid">
          <Card title="Role Security Architecture">
            <div className="roles-section">
              <h3 className="roles-subtitle">Core Operational Roles</h3>
              <div className="role-tags">
                {operationalRoles.map((r: string) => (
                  <span key={r} className={`role-tag ${role === r ? 'border-primary font-bold' : ''}`}>
                    {r} {role === r ? '(Current Session)' : ''}
                  </span>
                ))}
              </div>

              <h3 className="roles-subtitle">Monitoring, Alerts & Governance Roles</h3>
              <div className="role-tags">
                {governanceRoles.map((r: string) => (
                  <span key={r} className={`role-tag role-tag-secondary ${role === r ? 'border-primary font-bold' : ''}`}>
                    {r} {role === r ? '(Current Session)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
