import { api } from '../../../services/api';
import type {
  IssueMaterialPayload,
  MaterialIssueResult,
  StoresAvailabilityStatus,
} from '../types';

export const materialIssueService = {
  /**
   * Post material issue transaction to backend API
   */
  async submitMaterialIssue(payload: IssueMaterialPayload): Promise<MaterialIssueResult> {
    return api.post<MaterialIssueResult>('/api/material-issues', payload);
  },

  /**
   * Fetch stores availability for a specific SC
   */
  async getAvailability(scNumber: string): Promise<StoresAvailabilityStatus> {
    return api.get<StoresAvailabilityStatus>(`/api/stores/availability/${scNumber}`);
  },
};

export const storesService = materialIssueService;
