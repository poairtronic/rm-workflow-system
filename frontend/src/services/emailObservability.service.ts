import { api } from './api';

export interface EmailQueueObservabilitySummary {
  pending: number;
  processing: number;
  retrying: number;
  failed: number;
  sent: number;
  sentToday: number;
  sentLast24h?: number;
  dailyLimit?: number;
  priorityReserve?: number;
  queueByPriority?: {
    workflowPriority1: number;
    standardPriority5: number;
    digestPriority9: number;
  };
  digestsSentLast24h?: number;
  cooldownSuppressedCount?: number;
  successRate?: number;
  pausedUntil?: string | null;
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
  systemHealth?: 'HEALTHY' | 'DEGRADED';
  providerStatus?: string;
  providerIdentityLabel?: string;
  testProviderInProduction?: boolean;
  timestamp: string;
}

export const EmailObservabilityService = {
  async getObservability(tz?: string): Promise<EmailQueueObservabilitySummary> {
    const userTz = tz || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Kolkata');
    return api.get<EmailQueueObservabilitySummary>(`/api/email/observability?tz=${encodeURIComponent(userTz)}`);
  },
};
