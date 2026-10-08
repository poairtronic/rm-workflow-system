import { api } from './api';

export const dashboardsApi = {
  getDesigner: () => api.get<any>('/api/dashboards/designer'),
  getStores: () => api.get<any>('/api/dashboards/stores'),
  getProduction: () => api.get<any>('/api/dashboards/production'),
  getManagement: () => api.get<any>('/api/dashboards/management'),
};
