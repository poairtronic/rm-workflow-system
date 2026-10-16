const rawBaseUrl =
  (typeof import.meta !== 'undefined' &&
    (import.meta.env?.VITE_API_BASE_URL || import.meta.env?.VITE_BACKEND_URL)) ||
  'http://localhost:3000';

export const APP_CONFIG = {
  appName: 'V-SMART',
  appTitle: 'Velan Stock, Material & Asset Resource Tracker',
  apiBaseUrl: rawBaseUrl.replace(/\/api\/?$/, ''),
  healthEndpoint: '/health',
  version: '1.0.0-phase4',
};
