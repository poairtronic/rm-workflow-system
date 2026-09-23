import { Injectable } from '@nestjs/common';
import { EmailJob } from '../entities/email-job.entity.js';

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
  private readonly knownTemplates: Record<
    string,
    (payload?: Record<string, any> | null) => ResolvedEmailContent
  > = {
    AUTH_PASSWORD_RESET: (payload) => ({
      subject: 'Security Notice: Password Reset Request',
      bodyText: `Hello,\n\nA password reset request was received for your account. Reset link: ${payload?.resetUrl || 'N/A'}\n\nIf you did not request this, please contact Security.`,
      bodyHtml: `<h3>Security Notice: Password Reset Request</h3><p>Hello,</p><p>A password reset request was received for your account. Reset link: <a href="${payload?.resetUrl || '#'}">${payload?.resetUrl || 'N/A'}</a></p><p>If you did not request this, please contact Security.</p>`,
    }),
    WORKFLOW_RM_SUBMITTED: (payload) => ({
      subject: `[RMRIT Notification] RM Request Submitted: ${payload?.rmNumber || 'RM Request'}`,
      bodyText: `An RM Request (${payload?.rmNumber || ''}) has been submitted for Stores review.`,
      bodyHtml: `<h3>RM Request Submitted</h3><p>An RM Request (<strong>${payload?.rmNumber || ''}</strong>) has been submitted for Stores review.</p>`,
    }),
    WORKFLOW_MATERIAL_ISSUED: (payload) => ({
      subject: `[RMRIT Notification] Material Issued for RM: ${payload?.rmNumber || 'RM Request'}`,
      bodyText: `Material has been issued by Stores for RM Request ${payload?.rmNumber || ''}.`,
      bodyHtml: `<h3>Material Issued</h3><p>Material has been issued by Stores for RM Request <strong>${payload?.rmNumber || ''}</strong>.</p>`,
    }),
    WORKFLOW_ADDITIONAL_REQUEST: (payload) => ({
      subject: `[RMRIT Notification] Additional Material Request: ${payload?.rmNumber || 'RM Request'}`,
      bodyText: `An additional material request was created for RM Request ${payload?.rmNumber || ''}.`,
      bodyHtml: `<h3>Additional Material Request</h3><p>An additional material request was created for RM Request <strong>${payload?.rmNumber || ''}</strong>.</p>`,
    }),
    WORKFLOW_SC_COMPLETED: (payload) => ({
      subject: `[RMRIT Notification] SC Completed: ${payload?.scNumber || 'Sales Component'}`,
      bodyText: `Sales Component ${payload?.scNumber || ''} has reached COMPLETED status.`,
      bodyHtml: `<h3>SC Completed</h3><p>Sales Component <strong>${payload?.scNumber || ''}</strong> has reached COMPLETED status.</p>`,
    }),
  };

  resolveContent(job: EmailJob): ResolvedEmailContent {
    // 1. Verify recipient email
    if (!job.recipientEmail || typeof job.recipientEmail !== 'string' || !job.recipientEmail.includes('@')) {
      throw new MalformedJobException(`Invalid or missing recipient email: "${job.recipientEmail}"`);
    }

    // 2. If job has complete direct subject & body, use directly
    const hasSubject = job.subject && job.subject.trim().length > 0;
    const hasText = job.bodyText && job.bodyText.trim().length > 0;
    const hasHtml = job.bodyHtml && job.bodyHtml.trim().length > 0;

    if (hasSubject && (hasText || hasHtml)) {
      return {
        subject: job.subject.trim(),
        bodyText: hasText ? job.bodyText : job.bodyHtml,
        bodyHtml: hasHtml ? job.bodyHtml : `<pre>${job.bodyText}</pre>`,
      };
    }

    // 3. Resolve via templateKey
    if (job.templateKey && this.knownTemplates[job.templateKey]) {
      const templateFn = this.knownTemplates[job.templateKey];
      const rendered = templateFn(job.payload);
      return {
        subject: hasSubject ? job.subject.trim() : rendered.subject,
        bodyText: hasText ? job.bodyText : rendered.bodyText,
        bodyHtml: hasHtml ? job.bodyHtml : rendered.bodyHtml,
      };
    }

    // 4. Missing required content and unknown template
    throw new MalformedJobException(
      `Job ${job.id} contains insufficient subject/body content and template_key "${job.templateKey}" is unknown`,
    );
  }
}
