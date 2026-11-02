import { api } from './api';
import type {
  EcrIssuePending,
  EcrIssueDetail,
  IssueEcrPayload,
} from '../types/ecrIssues.types';

export const ecrIssuesService = {
  getEcrIssues: async (): Promise<EcrIssuePending[]> => {
    const res = await api.get<EcrIssuePending[]>('/api/ecr-issues');
    return Array.isArray(res) ? res : (res as any)?.data || [];
  },

  getEcrIssueById: async (id: string): Promise<EcrIssueDetail> => {
    return api.get<EcrIssueDetail>(`/api/ecr-issues/${id}`);
  },

  issueEcrMaterial: async (
    id: string,
    payload: IssueEcrPayload,
  ): Promise<{ success: boolean; itemsIssued: number; materialIssueId: string; issuedAt: string }> => {
    return api.post<{ success: boolean; itemsIssued: number; materialIssueId: string; issuedAt: string }>(
      `/api/ecr-issues/${id}/issue`,
      payload,
    );
  },
};

export default ecrIssuesService;
