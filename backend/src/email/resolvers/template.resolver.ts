import { Injectable, Optional } from '@nestjs/common';
import { EmailJob } from '../entities/email-job.entity.js';
import { TemplateService, TemplateValidationError } from '../template.service.js';

export interface ResolvedEmailContent {
  subject: string;
  bodyText: string;
  bodyHtml: string;
}

export class MalformedJobException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedJobException';
  }
}

@Injectable()
export class TemplateResolver {
  private readonly templateService: TemplateService;

  constructor(@Optional() templateService?: TemplateService) {
    this.templateService = templateService || new TemplateService();
  }

  resolveContent(job: EmailJob): ResolvedEmailContent {
    // 1. Verify recipient email format and check for header injection
    const rawRecipient = (job.recipientEmail || '').trim();
    if (
      !rawRecipient ||
      rawRecipient.includes('\r') ||
      rawRecipient.includes('\n') ||
      rawRecipient.includes(',') ||
      rawRecipient.includes(';') ||
      !rawRecipient.includes('@')
    ) {
      throw new MalformedJobException(`Invalid or missing recipient email: "${job.recipientEmail}"`);
    }

    // 2. Sanitize subject from CRLF header injection
    const sanitizeSubject = (sub?: string) => (sub ? sub.replace(/[\r\n]+/g, ' ').trim() : '');

    // 3. If job has complete direct subject & body, use directly
    const hasSubject = job.subject && job.subject.trim().length > 0;
    const hasText = job.bodyText && job.bodyText.trim().length > 0;
    const hasHtml = job.bodyHtml && job.bodyHtml.trim().length > 0;

    if (hasSubject && (hasText || hasHtml)) {
      return {
        subject: sanitizeSubject(job.subject),
        bodyText: hasText ? job.bodyText : job.bodyHtml,
        bodyHtml: hasHtml ? job.bodyHtml : `<pre>${job.bodyText}</pre>`,
      };
    }

    // 4. Resolve via TemplateService / templateKey
    if (job.templateKey && this.templateService.isValidTemplateKey(job.templateKey)) {
      try {
        const payload = {
          recipientName: job.recipientName,
          ...job.payload,
        };
        const rendered = this.templateService.render(job.templateKey, payload);
        return {
          subject: hasSubject ? sanitizeSubject(job.subject) : sanitizeSubject(rendered.subject),
          bodyText: hasText ? job.bodyText : rendered.text,
          bodyHtml: hasHtml ? job.bodyHtml : rendered.html,
        };
      } catch (err: any) {
        if (err instanceof TemplateValidationError) {
          throw new MalformedJobException(`Template resolution failed for job ${job.id}: ${err.message}`);
        }
        throw err;
      }
    }

    // 5. Missing required content and unknown template
    throw new MalformedJobException(
      `Job ${job.id} contains insufficient subject/body content and template_key "${job.templateKey}" is unknown`,
    );
  }
}
