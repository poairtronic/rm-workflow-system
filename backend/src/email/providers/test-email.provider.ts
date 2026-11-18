import { Injectable } from '@nestjs/common';
import {
  IEmailProvider,
  EmailDeliveryMessage,
  EmailDeliveryResult,
} from '../interfaces/email-provider.interface.js';

@Injectable()
export class TestEmailProvider implements IEmailProvider {
  public sentMessages: EmailDeliveryMessage[] = [];
  public shouldFailRetryable: boolean = false;
  public shouldFailNonRetryable: boolean = false;
  public shouldSimulateRateLimit: boolean = false;
  public rateLimitRetryAfterDate?: Date;
  public isUnavailable: boolean = false;
  public customErrorMessage?: string;
  public customMessageIdPrefix: string = 'test-msg';

  private messageCounter: number = 0;

  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    if (this.shouldSimulateRateLimit) {
      const retryDate = this.rateLimitRetryAfterDate || new Date(Date.now() + 15 * 60 * 1000);
      const isoStr = retryDate.toISOString();
      return {
        success: false,
        error: this.customErrorMessage || `User-rate limit exceeded. Retry after ${isoStr} (Mail sending)`,
        retryable: true,
        isRateLimited: true,
        retryAfterDate: retryDate,
      };
    }

    if (this.isUnavailable) {
      return {
        success: false,
        error: this.customErrorMessage || 'TestEmailProvider unavailable',
        retryable: true,
      };
    }

    if (this.shouldFailNonRetryable) {
      return {
        success: false,
        error: this.customErrorMessage || 'Non-retryable test provider failure',
        retryable: false,
      };
    }

    if (this.shouldFailRetryable) {
      return {
        success: false,
        error: this.customErrorMessage || 'Retryable test provider failure',
        retryable: true,
      };
    }

    this.messageCounter++;
    const providerMessageId = `${this.customMessageIdPrefix}-${Date.now()}-${this.messageCounter}`;

    this.sentMessages.push({
      ...message,
    });

    return {
      success: true,
      providerMessageId,
    };
  }

  reset(): void {
    this.sentMessages = [];
    this.shouldFailRetryable = false;
    this.shouldFailNonRetryable = false;
    this.shouldSimulateRateLimit = false;
    this.rateLimitRetryAfterDate = undefined;
    this.isUnavailable = false;
    this.customErrorMessage = undefined;
    this.messageCounter = 0;
  }
}
