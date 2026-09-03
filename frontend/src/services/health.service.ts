import { api } from './api';
import type { HealthCheckResponse } from '../types/api';

export const HealthService = {
  async checkHealth(): Promise<HealthCheckResponse> {
    return api.get<HealthCheckResponse>('/api/health');
  },
};
