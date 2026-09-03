export const APP_CONFIG = {
  appName: 'RMRIT',
  appTitle: 'RM Workflow & Traceability System',
  apiBaseUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
  healthEndpoint: '/api/health',
  version: '1.0.0-phase4',
};
