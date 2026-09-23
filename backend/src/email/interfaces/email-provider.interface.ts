export interface EmailDeliveryMessage {
  to: string;
  recipientName?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  eventType?: string;
  templateKey?: string;
  jobId?: string;
  idempotencyKey?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  retryable?: boolean;
}

export interface IEmailProvider {
  send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult>;
}

export const EMAIL_PROVIDER = 'EMAIL_PROVIDER';
