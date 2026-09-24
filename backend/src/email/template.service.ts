import { Injectable } from '@nestjs/common';

export interface RenderedEmailContent {
  templateKey: string;
  subject: string;
  html: string;
  text: string;
  bodyHtml: string;
  bodyText: string;
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

export interface TemplateDefinition {
  key: string;
  aliases?: string[];
  requiredVars: string[];
  allowedVars: string[];
  render: (variables: Record<string, any>, escapeHtml: (s?: string | null) => string) => {
    subject: string;
    html: string;
    text: string;
  };
}

const FORBIDDEN_SECRET_KEYS = [
  'password',
  'jwt',
  'refreshtoken',
  'refresh_token',
  'databaseurl',
  'database_url',
  'process.env',
  'process_env',
  'supabase_service_role_key',
  'supabaseservicerolekey',
  'supabase_secret_key',
  'supabasesecretkey',
  'gmail_client_secret',
  'gmailclientsecret',
  'gmail_refresh_token',
  'gmailrefreshtoken',
  'jwt_secret',
  'jwtsecret',
  'bearer',
  'oauth_secret',
];

@Injectable()
export class TemplateService {
  private escapeHtml(str?: string | null): string {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private readonly registry: Record<string, TemplateDefinition> = {
    LOGIN_NOTIFICATION: {
      key: 'LOGIN_NOTIFICATION',
      aliases: ['AUTH_LOGIN_NOTIFICATION'],
      requiredVars: ['recipientName'],
      allowedVars: ['recipientName', 'loginTime', 'ipAddress'],
      render: (vars, escape) => {
        const name = escape(vars.recipientName || 'User');
        return {
          subject: 'Security Notice: Account Login',
          text: `Hello ${vars.recipientName || 'User'},\n\nA login to your account was detected.`,
          html: `<h3>Security Notice: Account Login</h3><p>Hello <strong>${name}</strong>,</p><p>A login to your account was detected.</p>`,
        };
      },
    },

    PASSWORD_RESET: {
      key: 'PASSWORD_RESET',
      aliases: ['AUTH_PASSWORD_RESET'],
      requiredVars: ['resetUrl'],
      allowedVars: ['recipientName', 'resetUrl'],
      render: (vars, escape) => {
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : 'User';
        const rawName = vars.recipientName || 'User';
        const url = escape(vars.resetUrl);
        return {
          subject: 'Security Notice: Password Reset Request',
          text: `Hello ${rawName},\n\nA password reset request was received for your account. Reset link: ${vars.resetUrl}\n\nIf you did not request this, please contact Security.`,
          html: `<h3>Security Notice: Password Reset Request</h3><p>Hello ${name},</p><p>A password reset request was received for your account. Reset link: <a href="${url}">${url}</a></p><p>If you did not request this, please contact Security.</p>`,
        };
      },
    },

    RM_SUBMITTED: {
      key: 'RM_SUBMITTED',
      aliases: ['WORKFLOW_RM_SUBMITTED'],
      requiredVars: ['rmNumber'],
      allowedVars: ['recipientName', 'rmNumber', 'rmRequestId', 'scNumber'],
      render: (vars, escape) => {
        const rmNum = vars.rmNumber || vars.rmRequestId || 'RM Request';
        const escRmNum = escape(rmNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[RMRIT Notification] RM Request Submitted: ${rmNum}`,
          text: `${greeting}An RM Request (${rmNum}) has been submitted for Stores review.`,
          html: `<h3>RM Request Submitted</h3>${htmlGreeting}<p>An RM Request (<strong>${escRmNum}</strong>) has been submitted for Stores review.</p>`,
        };
      },
    },

    MATERIAL_ISSUED: {
      key: 'MATERIAL_ISSUED',
      aliases: ['WORKFLOW_MATERIAL_ISSUED'],
      requiredVars: ['rmNumber'],
      allowedVars: ['recipientName', 'rmNumber', 'scNumber', 'scId', 'materialIssueId'],
      render: (vars, escape) => {
        const rmNum = vars.rmNumber || vars.materialIssueId || vars.scNumber || 'RM Request';
        const escRmNum = escape(rmNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[RMRIT Notification] Material Issued for RM: ${rmNum}`,
          text: `${greeting}Material has been issued by Stores for RM Request ${rmNum}.`,
          html: `<h3>Material Issued</h3>${htmlGreeting}<p>Material has been issued by Stores for RM Request <strong>${escRmNum}</strong>.</p>`,
        };
      },
    },

    ADDITIONAL_MATERIAL_REQUESTED: {
      key: 'ADDITIONAL_MATERIAL_REQUESTED',
      aliases: ['ADDITIONAL_REQUEST', 'WORKFLOW_ADDITIONAL_REQUEST'],
      requiredVars: ['rmNumber'],
      allowedVars: ['recipientName', 'rmNumber', 'scId', 'scNumber', 'requestId'],
      render: (vars, escape) => {
        const rmNum = vars.rmNumber || vars.requestId || vars.scNumber || 'RM Request';
        const escRmNum = escape(rmNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[RMRIT Notification] Additional Material Request: ${rmNum}`,
          text: `${greeting}An additional material request was created for RM Request ${rmNum}.`,
          html: `<h3>Additional Material Request</h3>${htmlGreeting}<p>An additional material request was created for RM Request <strong>${escRmNum}</strong>.</p>`,
        };
      },
    },

    SC_COMPLETED: {
      key: 'SC_COMPLETED',
      aliases: ['WORKFLOW_SC_COMPLETED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[RMRIT Notification] SC Completed: ${scNum}`,
          text: `${greeting}Sales Component ${scNum} has reached COMPLETED status.`,
          html: `<h3>SC Completed</h3>${htmlGreeting}<p>Sales Component <strong>${escScNum}</strong> has reached COMPLETED status.</p>`,
        };
      },
    },
  };

  /**
   * Resolves canonical key or alias key to actual TemplateDefinition.
   */
  private findTemplateDef(templateKey: string): TemplateDefinition | undefined {
    if (!templateKey) return undefined;
    const normalizedKey = templateKey.trim().toUpperCase();
    if (this.registry[normalizedKey]) {
      return this.registry[normalizedKey];
    }
    for (const def of Object.values(this.registry)) {
      if (def.aliases && def.aliases.includes(normalizedKey)) {
        return def;
      }
    }
    return undefined;
  }

  /**
   * Returns true if templateKey is registered.
   */
  isValidTemplateKey(templateKey: string): boolean {
    return !!this.findTemplateDef(templateKey);
  }

  /**
   * Returns registered template keys list.
   */
  getRegisteredKeys(): string[] {
    return Object.keys(this.registry);
  }

  /**
   * Validates variables and renders template content.
   */
  render(templateKey: string, variables: Record<string, any> = {}): RenderedEmailContent {
    const def = this.findTemplateDef(templateKey);
    if (!def) {
      throw new TemplateValidationError(`Unknown or unregistered template key: "${templateKey}"`);
    }

    // Check forbidden secret keys
    for (const key of Object.keys(variables || {})) {
      const lower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (FORBIDDEN_SECRET_KEYS.includes(lower)) {
        throw new TemplateValidationError(
          `Forbidden sensitive variable detected in payload: "${key}"`,
        );
      }
    }

    // Check required variables
    for (const reqVar of def.requiredVars) {
      // Check if primary reqVar or any fallback equivalent exists in variables
      const hasValue =
        variables[reqVar] !== undefined &&
        variables[reqVar] !== null &&
        String(variables[reqVar]).trim() !== '';

      const hasFallback =
        (reqVar === 'rmNumber' && (variables.rmRequestId || variables.requestId || variables.materialIssueId)) ||
        (reqVar === 'scNumber' && (variables.scId || variables.scNumber));

      if (!hasValue && !hasFallback) {
        throw new TemplateValidationError(
          `Missing required variable "${reqVar}" for template "${templateKey}"`,
        );
      }
    }

    // Render content
    const rendered = def.render(variables, (s) => this.escapeHtml(s));

    return {
      templateKey: def.key,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
    };
  }
}
