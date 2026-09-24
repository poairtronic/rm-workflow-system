import { api } from './api';

export interface EmailQueueObservabilitySummary {
  pending: number;
  processing: number;
  retrying: number;
  failed: number;
  sent: number;
  total: number;
  lastSuccessfulSend: {
    timestamp: string | null;
    eventType?: string | null;
    recipientEmail?: string | null;
  } | null;
  lastFailure: {
    timestamp: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    eventType?: string | null;
  } | null;
  timestamp: string;
}

export const EmailObservabilityService = {
  async getObservability(): Promise<EmailQueueObservabilitySummary> {
    return api.get<EmailQueueObservabilitySummary>('/api/email/observability');
  },
};
