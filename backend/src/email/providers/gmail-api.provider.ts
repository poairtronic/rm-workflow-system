import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, gmail_v1 } from 'googleapis';
import {
  IEmailProvider,
  EmailDeliveryMessage,
  EmailDeliveryResult,
} from '../interfaces/email-provider.interface.js';

export interface GmailApiProviderOptions {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  senderEmail?: string;
  gmailClient?: gmail_v1.Gmail;
}

@Injectable()
export class GmailApiProvider implements IEmailProvider {
  private readonly logger = new Logger(GmailApiProvider.name);

  public readonly clientId?: string;
  public readonly clientSecret?: string;
  public readonly refreshToken?: string;
  public readonly senderEmail?: string;

  private gmailClient?: gmail_v1.Gmail;
  private oauth2Client?: any;

  constructor(
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    @Inject('GMAIL_API_OPTIONS')
    options?: GmailApiProviderOptions,
  ) {
    this.clientId =
      options?.clientId ??
      this.configService?.get<string>('GMAIL_CLIENT_ID') ??
      process.env.GMAIL_CLIENT_ID;

    this.clientSecret =
      options?.clientSecret ??
      this.configService?.get<string>('GMAIL_CLIENT_SECRET') ??
      process.env.GMAIL_CLIENT_SECRET;

    this.refreshToken =
      options?.refreshToken ??
      this.configService?.get<string>('GMAIL_REFRESH_TOKEN') ??
      process.env.GMAIL_REFRESH_TOKEN;

    this.senderEmail =
      options?.senderEmail ??
      this.configService?.get<string>('GMAIL_SENDER_EMAIL') ??
      process.env.GMAIL_SENDER_EMAIL;

    if (options?.gmailClient) {
      this.gmailClient = options.gmailClient;
    } else if (this.clientId && this.clientSecret && this.refreshToken) {
      this.initGoogleClient();
    } else {
      this.logger.warn(
        'GmailApiProvider instantiated with incomplete Google OAuth credentials. Real API calls will fail until configured.',
      );
    }
  }

  private initGoogleClient(): void {
    try {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
      );

      this.oauth2Client.setCredentials({
        refresh_token: this.refreshToken,
      });

      this.gmailClient = google.gmail({
        version: 'v1',
        auth: this.oauth2Client,
      });

      this.logger.log(
        `GmailApiProvider initialized successfully for sender [${this.senderEmail || 'default'}]`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to initialize Google OAuth2 Gmail client: ${this.maskSecrets(error?.message || String(error))}`,
      );
    }
  }

  /**
   * Constructs an RFC 2822 compliant MIME message string.
   */
  public buildMimeMessage(message: EmailDeliveryMessage): string {
    const sender = this.senderEmail || 'me';
    const recipient = message.recipientName
      ? `"${message.recipientName.replace(/"/g, '')}" <${message.to}>`
      : message.to;

    const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const lines: string[] = [
      `From: ${sender}`,
      `To: ${recipient}`,
      `Subject: ${message.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      message.bodyText || '',
      ``,
    ];

    if (message.bodyHtml) {
      lines.push(
        `--${boundary}`,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: 7bit`,
        ``,
        message.bodyHtml,
        ``,
      );
    }

    lines.push(`--${boundary}--`);

    return lines.join('\r\n');
  }

  /**
   * Encodes a raw MIME message string into RFC 4648 Base64URL safe format required by Gmail API.
   */
  public encodeBase64Url(mimeString: string): string {
    return Buffer.from(mimeString, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Delivers an email message via Gmail API users.messages.send.
   */
  async send(message: EmailDeliveryMessage): Promise<EmailDeliveryResult> {
    if (!this.gmailClient) {
      return {
        success: false,
        error: 'GmailApiProvider is not configured with valid OAuth credentials',
        retryable: true,
      };
    }

    try {
      const mimeMessage = this.buildMimeMessage(message);
      const rawBase64Url = this.encodeBase64Url(mimeMessage);
      const userId = this.senderEmail || 'me';

      const res = await this.gmailClient.users.messages.send({
        userId,
        requestBody: {
          raw: rawBase64Url,
        },
      });

      const providerMessageId = res.data.id || undefined;

      this.logger.log(
        `Successfully sent email via Gmail API [Message ID: ${providerMessageId || 'N/A'}, Recipient: ${message.to}]`,
      );

      return {
        success: true,
        providerMessageId,
      };
    } catch (error: any) {
      const rawErrorMessage = error?.message || String(error);
      const statusCode =
        error?.status ||
        error?.code ||
        error?.response?.status ||
        error?.response?.data?.error?.code;

      const isRetryable = this.determineRetryable(statusCode, error);
      const sanitizedError = this.maskSecrets(rawErrorMessage);

      this.logger.error(
        `Gmail API send failure for [Recipient: ${message.to}] (Status: ${statusCode || 'N/A'}, Retryable: ${isRetryable}): ${sanitizedError}`,
      );

      return {
        success: false,
        error: sanitizedError,
        retryable: isRetryable,
      };
    }
  }

  /**
   * Determines whether a Gmail API error is retryable.
   */
  private determineRetryable(statusCode: any, error: any): boolean {
    const code = Number(statusCode);
    if (!isNaN(code)) {
      if (code === 429 || code >= 500) {
        return true;
      }
      if (code >= 400 && code < 500) {
        return false;
      }
    }

    const errStr = String(error?.message || error).toLowerCase();
    if (
      errStr.includes('econnreset') ||
      errStr.includes('etimedout') ||
      errStr.includes('enotfound') ||
      errStr.includes('fetch failed') ||
      errStr.includes('rate limit') ||
      errStr.includes('quota exceeded') ||
      errStr.includes('backend error') ||
      errStr.includes('service unavailable')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Masks any sensitive OAuth tokens or secrets from error logs or strings.
   */
  public maskSecrets(text: string): string {
    if (!text) {
      return text;
    }
    let sanitized = text;

    if (this.clientSecret) {
      sanitized = sanitized.replaceAll(this.clientSecret, '[REDACTED_CLIENT_SECRET]');
    }
    if (this.refreshToken) {
      sanitized = sanitized.replaceAll(this.refreshToken, '[REDACTED_REFRESH_TOKEN]');
    }
    if (this.clientId) {
      sanitized = sanitized.replaceAll(this.clientId, '[REDACTED_CLIENT_ID]');
    }

    // Generic token masking for OAuth tokens if present in URLs/headers
    sanitized = sanitized.replace(/access_token=[^&]+/gi, 'access_token=[REDACTED]');
    sanitized = sanitized.replace(/refresh_token=[^&]+/gi, 'refresh_token=[REDACTED]');
    sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [REDACTED]');

    return sanitized;
  }
}
