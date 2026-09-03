import { useEffect, useState } from 'react';
import './App.css';

interface HealthResponse {
  status: string;
  service: string;
  timestamp?: string;
  database?: string;
}

interface AuthRolesResponse {
  operationalRoles: string[];
  governanceRoles: string[];
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [roles, setRoles] = useState<AuthRolesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, rolesRes] = await Promise.all([
        fetch(`${backendUrl}/api/health`),
        fetch(`${backendUrl}/api/auth/roles`).catch(() => null),
      ]);

      if (!healthRes.ok) {
        throw new Error(`HTTP error ${healthRes.status}: ${healthRes.statusText}`);
      }

      const healthData = await healthRes.json();
      setHealth(healthData);

      if (rolesRes && rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <div className="badge-wrapper">
          <span className="system-badge">RMRIT</span>
          <span className="phase-badge">Phase 4 Foundation</span>
        </div>
        <h1 className="title">RM Workflow & Traceability System</h1>
        <p className="subtitle">
          Internal Manufacturing Material Traceability · Shop Floor Chain of Custody
        </p>
      </header>

      <main className="main-content">
        {/* Live Architecture Communication Card */}
        <section className="card primary-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Frontend ↔ Backend Connectivity</h2>
              <p className="card-desc">Validates real-time HTTP & CORS communication with NestJS</p>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="action-button"
            >
              {loading ? 'Checking...' : '↻ Re-test Connection'}
            </button>
          </div>

          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Backend Target</span>
              <code className="status-code">{backendUrl}</code>
            </div>
            <div className="status-item">
              <span className="status-label">API Health Endpoint</span>
              <code className="status-code">GET /api/health</code>
            </div>
            <div className="status-item">
              <span className="status-label">Connection Status</span>
              {loading ? (
                <span className="badge badge-warning">● Checking...</span>
              ) : error ? (
                <span className="badge badge-error">✕ Disconnected</span>
              ) : (
                <span className="badge badge-success">✓ Connected ({health?.status})</span>
              )}
            </div>
            <div className="status-item">
              <span className="status-label">Last Verified</span>
              <span className="status-value">{lastChecked || 'Pending'}</span>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              <strong>Connection Error:</strong> {error}
              <p className="alert-hint">
                Ensure backend is running: <code>npm run start:dev</code> inside <code>backend/</code>.
              </p>
            </div>
          )}

          {health && (
            <div className="response-box">
              <span className="response-label">Raw Response Payload:</span>
              <pre>{JSON.stringify(health, null, 2)}</pre>
            </div>
          )}
        </section>

        {/* System Verification Grid */}
        <div className="two-col-grid">
          {/* Phase 4 Foundation Checklist */}
          <section className="card">
            <h2 className="card-title">Phase 4 Verification Matrix</h2>
            <ul className="checklist">
              <li className="check-item">
                <span className="check-icon">✓</span>
                <div>
                  <strong>React + TypeScript (Vite)</strong>
                  <p>Client scaffolded with strict typing and modern bundling</p>
                </div>
              </li>
              <li className="check-item">
                <span className="check-icon">✓</span>
                <div>
                  <strong>Node.js + NestJS Backend</strong>
                  <p>Modular architecture with TypeScript & ES module resolution</p>
                </div>
              </li>
              <li className="check-item">
                <span className="check-icon">✓</span>
                <div>
                  <strong>TypeORM + PostgreSQL Driver</strong>
                  <p>Configured with environment variables and SSL auto-detection</p>
                </div>
              </li>
              <li className="check-item">
                <span className="check-icon">✓</span>
                <div>
                  <strong>JWT Authentication Foundation</strong>
                  <p>Passport strategy, JwtAuthGuard, and RolesGuard in place</p>
                </div>
              </li>
              <li className="check-item">
                <span className="check-icon">✓</span>
                <div>
                  <strong>CORS & Security Protection</strong>
                  <p>Allowed origin configured; .env excluded from Git</p>
                </div>
              </li>
            </ul>
          </section>

          {/* Role Architecture Foundation */}
          <section className="card">
            <h2 className="card-title">Role Security Architecture</h2>
            <p className="card-desc">Established hierarchy for future workflow stages</p>

            <div className="roles-section">
              <h3 className="roles-subtitle">Core Operational Roles</h3>
              <div className="role-tags">
                {(roles?.operationalRoles || [
                  'ADMIN',
                  'DESIGN_USER',
                  'SENIOR_MANAGER',
                  'STORES_MANAGER',
                  'PRODUCTION_USER',
                ]).map((r) => (
                  <span key={r} className="role-tag">
                    {r}
                  </span>
                ))}
              </div>

              <h3 className="roles-subtitle">Future Governance Roles</h3>
              <div className="role-tags">
                {(roles?.governanceRoles || ['ACCOUNTS', 'PRODUCTION_MANAGER', 'MANAGEMENT']).map(
                  (r) => (
                    <span key={r} className="role-tag role-tag-secondary">
                      {r}
                    </span>
                  )
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>RMRIT Phase 4 Foundation · Ready for Phase 5 Database Design & Migration</p>
      </footer>
    </div>
  );
}
