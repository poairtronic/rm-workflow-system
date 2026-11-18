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
      allowedVars: ['recipientName', 'resetUrl', 'expiresInMinutes'],
      render: (vars, escape) => {
        const name = vars.recipientName ? escape(vars.recipientName) : 'Team Member';
        const rawName = vars.recipientName || 'Team Member';
        const url = escape(vars.resetUrl);
        const expiresMinutes = vars.expiresInMinutes || 60;
        return {
          subject: '[V-SMART] Password Reset Request',
          text: `Hello ${rawName},\n\nA password reset request was received for your V-SMART account.\n\nClick the link below to reset your password (valid for ${expiresMinutes} minutes):\n${vars.resetUrl}\n\nIf you did not request this, you can safely ignore this email. Your password will remain unchanged.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
              <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 24px; text-align: center;">
                <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 8px; padding: 6px 14px; margin-bottom: 12px;">
                  <span style="color: #ffffff; font-weight: 700; font-size: 14px; letter-spacing: 0.5px;">V-SMART PORTAL</span>
                </div>
                <h1 style="color: #ffffff; font-size: 20px; font-weight: 700; margin: 0;">Password Reset Request</h1>
              </div>
              <div style="padding: 32px 28px;">
                <p style="color: #1e293b; font-size: 15px; line-height: 1.6; margin-top: 0;">Hello <strong>${name}</strong>,</p>
                <p style="color: #475569; font-size: 14px; line-height: 1.6;">We received a request to reset the password for your V-SMART Enterprise account. Click the button below to choose a new password:</p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${url}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.25);">Reset Password</a>
                </div>
                <p style="color: #64748b; font-size: 12px; line-height: 1.5;">This password reset link is valid for <strong>${expiresMinutes} minutes</strong>. If you did not make this request, you can safely ignore this email; your existing password will remain unchanged.</p>
                <div style="border-top: 1px solid #f1f5f9; margin-top: 24px; padding-top: 16px;">
                  <p style="color: #94a3b8; font-size: 11px; margin: 0; word-break: break-all;">If the button above does not work, copy and paste this URL into your browser:<br/><a href="${url}" style="color: #2563eb; text-decoration: none;">${url}</a></p>
                </div>
              </div>
            </div>
          `.trim(),
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
          subject: `[V-SMART Notification] RM Request Submitted: ${rmNum}`,
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
          subject: `[V-SMART Notification] Material Issued for RM: ${rmNum}`,
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
          subject: `[V-SMART Notification] Additional Material Request: ${rmNum}`,
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
          subject: `[V-SMART Notification] SC Completed: ${scNum}`,
          text: `${greeting}Sales Component ${scNum} has reached COMPLETED status.`,
          html: `<h3>SC Completed</h3>${htmlGreeting}<p>Sales Component <strong>${escScNum}</strong> has reached COMPLETED status.</p>`,
        };
      },
    },

    MSL_LOW_STOCK: {
      key: 'MSL_LOW_STOCK',
      aliases: ['WORKFLOW_MSL_LOW_STOCK'],
      requiredVars: ['productName'],
      allowedVars: ['recipientName', 'productName', 'productId', 'currentStock', 'minimumInventory', 'deficit'],
      render: (vars, escape) => {
        const prod = vars.productName || vars.productId || 'Raw Material';
        const escProd = escape(prod);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        const stock = vars.currentStock !== undefined ? vars.currentStock : 'N/A';
        const min = vars.minimumInventory !== undefined ? vars.minimumInventory : 'N/A';
        const deficit = vars.deficit !== undefined ? vars.deficit : 'N/A';
        return {
          subject: `[V-SMART Alert] Low Stock Warning: ${prod}`,
          text: `${greeting}Warning: Product ${prod} has dropped below Minimum Stock Level.\nCurrent Stock: ${stock}\nMinimum Required: ${min}\nDeficit: ${deficit}\n\nPlease take appropriate procurement action.`,
          html: `<h3>Low Stock Alert</h3>${htmlGreeting}<p>Warning: Product <strong>${escProd}</strong> has dropped below Minimum Stock Level.</p><ul><li><strong>Current Stock:</strong> ${stock}</li><li><strong>Minimum Required:</strong> ${min}</li><li><strong>Deficit:</strong> ${deficit}</li></ul><p>Please take appropriate procurement action.</p>`,
        };
      },
    },

    MSL_OUT_OF_STOCK: {
      key: 'MSL_OUT_OF_STOCK',
      aliases: ['WORKFLOW_MSL_OUT_OF_STOCK'],
      requiredVars: ['productName'],
      allowedVars: ['recipientName', 'productName', 'productId', 'currentStock', 'minimumInventory', 'deficit'],
      render: (vars, escape) => {
        const prod = vars.productName || vars.productId || 'Raw Material';
        const escProd = escape(prod);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        const min = vars.minimumInventory !== undefined ? vars.minimumInventory : 'N/A';
        return {
          subject: `[V-SMART Alert] CRITICAL: OUT OF STOCK: ${prod}`,
          text: `${greeting}CRITICAL: Product ${prod} is completely OUT OF STOCK (Current Stock: 0, Minimum Required: ${min}).\n\nImmediate restocking is required.`,
          html: `<h3>CRITICAL: Out of Stock Alert</h3>${htmlGreeting}<p>CRITICAL: Product <strong>${escProd}</strong> is completely <strong>OUT OF STOCK</strong> (Current Stock: 0, Minimum Required: ${min}).</p><p>Immediate restocking is required.</p>`,
        };
      },
    },

    MSL_RESOLVED: {
      key: 'MSL_RESOLVED',
      aliases: ['WORKFLOW_MSL_RESOLVED'],
      requiredVars: ['productName'],
      allowedVars: ['recipientName', 'productName', 'productId', 'currentStock', 'minimumInventory'],
      render: (vars, escape) => {
        const prod = vars.productName || vars.productId || 'Raw Material';
        const escProd = escape(prod);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        const stock = vars.currentStock !== undefined ? vars.currentStock : 'N/A';
        const min = vars.minimumInventory !== undefined ? vars.minimumInventory : 'N/A';
        return {
          subject: `[V-SMART Notice] Stock Restored: ${prod}`,
          text: `${greeting}Notice: Stock for product ${prod} has been replenished to or above Minimum Stock Level.\nCurrent Stock: ${stock}\nMinimum Level: ${min}`,
          html: `<h3>Stock Restored</h3>${htmlGreeting}<p>Notice: Stock for product <strong>${escProd}</strong> has been replenished to or above Minimum Stock Level.</p><p><strong>Current Stock:</strong> ${stock} (Minimum Level: ${min})</p>`,
        };
      },
    },

    // ─── Phase 17 B3.3: Material Receipt, Return & Extra Material Templates ───

    MATERIAL_RECEIVED: {
      key: 'MATERIAL_RECEIVED',
      aliases: ['WORKFLOW_MATERIAL_RECEIVED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'receiptId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Material Received: ${scNum}`,
          text: `${greeting}Material receipt has been confirmed for SC ${scNum}.`,
          html: `<h3>Material Received</h3>${htmlGreeting}<p>Material receipt has been confirmed for SC <strong>${escScNum}</strong>.</p>`,
        };
      },
    },

    MATERIAL_RETURNED: {
      key: 'MATERIAL_RETURNED',
      aliases: ['WORKFLOW_MATERIAL_RETURNED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'returnId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Material Return Submitted: ${scNum}`,
          text: `${greeting}Material return has been submitted for SC ${scNum} and awaits Stores acknowledgment.`,
          html: `<h3>Material Return Submitted</h3>${htmlGreeting}<p>Material return has been submitted for SC <strong>${escScNum}</strong> and awaits Stores acknowledgment.</p>`,
        };
      },
    },

    RETURN_VERIFIED: {
      key: 'RETURN_VERIFIED',
      aliases: ['WORKFLOW_RETURN_VERIFIED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'returnId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Material Return Acknowledged: ${scNum}`,
          text: `${greeting}Material return for SC ${scNum} has been verified and acknowledged by Stores.`,
          html: `<h3>Material Return Acknowledged</h3>${htmlGreeting}<p>Material return for SC <strong>${escScNum}</strong> has been verified and acknowledged by Stores.</p>`,
        };
      },
    },

    EXTRA_MATERIAL_APPROVED: {
      key: 'EXTRA_MATERIAL_APPROVED',
      aliases: ['WORKFLOW_EXTRA_MATERIAL_APPROVED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'requestId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Additional Material Approved: ${scNum}`,
          text: `${greeting}Additional material request for SC ${scNum} has been APPROVED by Stores.`,
          html: `<h3>Additional Material Approved</h3>${htmlGreeting}<p>Additional material request for SC <strong>${escScNum}</strong> has been APPROVED by Stores.</p>`,
        };
      },
    },

    EXTRA_MATERIAL_REJECTED: {
      key: 'EXTRA_MATERIAL_REJECTED',
      aliases: ['WORKFLOW_EXTRA_MATERIAL_REJECTED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'requestId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Additional Material Rejected: ${scNum}`,
          text: `${greeting}Additional material request for SC ${scNum} has been REJECTED by Stores.`,
          html: `<h3>Additional Material Rejected</h3>${htmlGreeting}<p>Additional material request for SC <strong>${escScNum}</strong> has been REJECTED by Stores.</p>`,
        };
      },
    },

    EXTRA_MATERIAL_ISSUED: {
      key: 'EXTRA_MATERIAL_ISSUED',
      aliases: ['WORKFLOW_EXTRA_MATERIAL_ISSUED'],
      requiredVars: ['scNumber'],
      allowedVars: ['recipientName', 'scNumber', 'scId', 'issueId'],
      render: (vars, escape) => {
        const scNum = vars.scNumber || vars.scId || 'Sales Component';
        const escScNum = escape(scNum);
        const name = vars.recipientName ? `${escape(vars.recipientName)}` : '';
        const greeting = name ? `Hello ${name},\n\n` : '';
        const htmlGreeting = name ? `<p>Hello ${name},</p>` : '';
        return {
          subject: `[V-SMART Notification] Additional Material Issued: ${scNum}`,
          text: `${greeting}Additional material has been issued by Stores for SC ${scNum}.`,
          html: `<h3>Additional Material Issued</h3>${htmlGreeting}<p>Additional material has been issued by Stores for SC <strong>${escScNum}</strong>.</p>`,
        };
      },
    },

    // ─── Phase 19.8: Delivery Challan Templates ───────────────────────────────

    DC_CREATED: {
      key: 'DC_CREATED',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'dispatchDate', 'expectedReturnDate'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] Delivery Challan Created: ${vars.challanNumber || 'N/A'}`,
          text: `${name}A new Delivery Challan has been created.\nChallan Number: ${vars.challanNumber || 'N/A'}\nVendor: ${vars.vendorName || 'N/A'}\nDispatch Date: ${vars.dispatchDate || 'N/A'}`,
          html: `<h3>Delivery Challan Created</h3>${htmlName}<p>A new Delivery Challan <strong>${cn}</strong> has been created for vendor <strong>${vendor}</strong>.</p><p><strong>Dispatch Date:</strong> ${escape(vars.dispatchDate || 'N/A')}<br/><strong>Expected Return:</strong> ${escape(vars.expectedReturnDate || 'N/A')}</p>`,
        };
      },
    },

    DC_DISPATCHED: {
      key: 'DC_DISPATCHED',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'dispatchDate', 'expectedReturnDate'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] Delivery Challan Dispatched: ${vars.challanNumber || 'N/A'}`,
          text: `${name}Delivery Challan ${vars.challanNumber || 'N/A'} has been dispatched to vendor ${vars.vendorName || 'N/A'}.\nExpected Return: ${vars.expectedReturnDate || 'N/A'}`,
          html: `<h3>Delivery Challan Dispatched</h3>${htmlName}<p>Challan <strong>${cn}</strong> has been dispatched to vendor <strong>${vendor}</strong>.</p><p><strong>Dispatch Date:</strong> ${escape(vars.dispatchDate || 'N/A')}<br/><strong>Expected Return:</strong> ${escape(vars.expectedReturnDate || 'N/A')}</p>`,
        };
      },
    },

    DC_APPROACHING_SLA: {
      key: 'DC_APPROACHING_SLA',
      requiredVars: ['challanNumber', 'expectedReturnDate'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'expectedReturnDate', 'hoursRemaining'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const hours = vars.hoursRemaining !== undefined ? vars.hoursRemaining : 'N/A';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] SLA Alert: Challan ${vars.challanNumber || 'N/A'} approaching return deadline`,
          text: `${name}SLA Warning: Delivery Challan ${vars.challanNumber || 'N/A'} is approaching its expected return date.\nVendor: ${vars.vendorName || 'N/A'}\nExpected Return: ${vars.expectedReturnDate}\nHours Remaining: ${hours}`,
          html: `<h3>⚠️ SLA Warning: Challan Approaching Deadline</h3>${htmlName}<p>Delivery Challan <strong>${cn}</strong> from vendor <strong>${vendor}</strong> is approaching its expected return date.</p><p><strong>Expected Return:</strong> ${escape(vars.expectedReturnDate)}<br/><strong>Hours Remaining:</strong> ${hours}</p><p>Please follow up with the vendor immediately.</p>`,
        };
      },
    },

    DC_OVERDUE: {
      key: 'DC_OVERDUE',
      requiredVars: ['challanNumber', 'expectedReturnDate'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'expectedReturnDate', 'daysOverdue'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const days = vars.daysOverdue !== undefined ? vars.daysOverdue : 'N/A';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] OVERDUE: Delivery Challan ${vars.challanNumber || 'N/A'} not returned`,
          text: `${name}OVERDUE: Delivery Challan ${vars.challanNumber || 'N/A'} has not been returned.\nVendor: ${vars.vendorName || 'N/A'}\nExpected Return: ${vars.expectedReturnDate}\nDays Overdue: ${days}\n\nImmediate follow-up required.`,
          html: `<h3>🚨 OVERDUE: Delivery Challan Not Returned</h3>${htmlName}<p>OVERDUE: Delivery Challan <strong>${cn}</strong> from vendor <strong>${vendor}</strong> has not been returned.</p><p><strong>Expected Return:</strong> ${escape(vars.expectedReturnDate)}<br/><strong>Days Overdue:</strong> ${days}</p><p><strong>Immediate follow-up is required.</strong></p>`,
        };
      },
    },

    DC_PARTIALLY_RETURNED: {
      key: 'DC_PARTIALLY_RETURNED',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'returnedQty', 'pendingQty'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] Partial Return Received: Challan ${vars.challanNumber || 'N/A'}`,
          text: `${name}Partial return received for Delivery Challan ${vars.challanNumber || 'N/A'} from vendor ${vars.vendorName || 'N/A'}.\nQuantity Returned: ${vars.returnedQty || 'N/A'}\nQuantity Pending: ${vars.pendingQty || 'N/A'}`,
          html: `<h3>Partial Return Received</h3>${htmlName}<p>Partial return received for Challan <strong>${cn}</strong> from vendor <strong>${vendor}</strong>.</p><ul><li><strong>Quantity Returned:</strong> ${vars.returnedQty || 'N/A'}</li><li><strong>Quantity Pending:</strong> ${vars.pendingQty || 'N/A'}</li></ul>`,
        };
      },
    },

    DC_RETURNED: {
      key: 'DC_RETURNED',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'actualReturnDate'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] Challan Fully Returned: ${vars.challanNumber || 'N/A'}`,
          text: `${name}All items from Delivery Challan ${vars.challanNumber || 'N/A'} have been returned from vendor ${vars.vendorName || 'N/A'}.\nActual Return Date: ${vars.actualReturnDate || 'N/A'}`,
          html: `<h3>Delivery Challan Fully Returned</h3>${htmlName}<p>All items from Challan <strong>${cn}</strong> have been returned by vendor <strong>${vendor}</strong>.</p><p><strong>Return Date:</strong> ${escape(vars.actualReturnDate || 'N/A')}</p>`,
        };
      },
    },

    DC_CLOSED: {
      key: 'DC_CLOSED',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] Delivery Challan Closed: ${vars.challanNumber || 'N/A'}`,
          text: `${name}Delivery Challan ${vars.challanNumber || 'N/A'} with vendor ${vars.vendorName || 'N/A'} has been administratively closed.`,
          html: `<h3>Delivery Challan Closed</h3>${htmlName}<p>Challan <strong>${cn}</strong> with vendor <strong>${vendor}</strong> has been administratively closed and archived.</p>`,
        };
      },
    },

    CONSUMABLE_RECEIPT_OVERDUE: {
      key: 'CONSUMABLE_RECEIPT_OVERDUE',
      requiredVars: ['description'],
      allowedVars: [
        'recipientName',
        'description',
        'prNumber',
        'requestCode',
        'createdAt',
        'hoursElapsed',
        'vendorName',
        'requestedQty',
        'purchaseQty',
        'uom',
        'endUser',
      ],
      render: (vars, escape) => {
        const desc = escape(vars.description || 'Consumable Item');
        const pr = escape(vars.prNumber || 'N/A');
        const reqCode = escape(vars.requestCode || 'N/A');
        const vendor = escape(vars.vendorName || 'Open Sourcing');
        const qty = escape(vars.purchaseQty || vars.requestedQty || 'N/A');
        const uom = escape(vars.uom || 'units');
        const hours = vars.hoursElapsed || '24+';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] OVERDUE SLA: Consumable Pending Receipt >24h - ${vars.description || 'Item'}`,
          text: `${name}🚨 OVERDUE CONSUMABLE RECEIPT SLA (>24h)\n\nThe following consumable item was requested more than 24 hours ago and has not been inwarded in stores:\n\n- Description: ${vars.description || 'N/A'}\n- PR Number: ${vars.prNumber || 'N/A'}\n- Request Code: ${vars.requestCode || 'N/A'}\n- Elapsed Time: ${hours} hours\n- Supplier / Vendor: ${vars.vendorName || 'Open Sourcing'}\n- Pending Quantity: ${qty} ${uom}\n- End User: ${vars.endUser || 'Plant'}\n\nPlease expedite delivery with the vendor or take necessary store fulfillment action.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 22px 24px; color: #ffffff; text-align: center;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">🚨 CONSUMABLE RECEIPT OVERDUE (>24H SLA)</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Velan Metrology Material Governance & Consumables Fulfillment</p>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  The following consumable item was requested over <strong>24 hours ago</strong> (${hours}h elapsed) and has <strong>not yet been physically received</strong> into Stores inventory:
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #1e293b;">
                  <p style="margin: 0 0 8px;"><strong>Item Description:</strong> ${desc}</p>
                  <p style="margin: 0 0 8px;"><strong>PR Number:</strong> ${pr}</p>
                  <p style="margin: 0 0 8px;"><strong>Request Code:</strong> ${reqCode}</p>
                  <p style="margin: 0 0 8px;"><strong>Quantity Pending Receipt:</strong> <span style="color: #dc2626; font-weight: 700;">${qty} ${uom}</span></p>
                  <p style="margin: 0 0 8px;"><strong>Supplier / Vendor:</strong> ${vendor}</p>
                  <p style="margin: 0;"><strong>End User:</strong> ${escape(vars.endUser || 'Plant Floor')}</p>
                </div>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                  Please follow up with the supplier or log delivery inwarding under <strong>Consumables &gt; Purchase &amp; Store Fulfillment</strong>.
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    CONSUMABLE_PARTIALLY_ISSUED_OVERDUE: {
      key: 'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE',
      requiredVars: ['description'],
      allowedVars: [
        'recipientName',
        'description',
        'prNumber',
        'requestCode',
        'createdAt',
        'hoursElapsed',
        'issuedQty',
        'requestedQty',
        'remainingQty',
        'uom',
        'endUser',
      ],
      render: (vars, escape) => {
        const desc = escape(vars.description || 'Consumable Item');
        const pr = escape(vars.prNumber || 'N/A');
        const reqCode = escape(vars.requestCode || 'N/A');
        const issued = escape(vars.issuedQty || '0');
        const requested = escape(vars.requestedQty || '0');
        const remaining = escape(vars.remainingQty || '0');
        const uom = escape(vars.uom || 'units');
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        return {
          subject: `[V-SMART] ACTION REQUIRED: Consumable Partially Issued - ${vars.description || 'Item'}`,
          text: `${name}⚠️ CONSUMABLE PARTIALLY ISSUED\n\nThe following consumable item is in Partially Issued status with balance awaiting issue to Production:\n\n- Description: ${vars.description || 'N/A'}\n- PR Number: ${vars.prNumber || 'N/A'}\n- Request Code: ${vars.requestCode || 'N/A'}\n- Quantity Issued: ${issued} ${uom}\n- Quantity Requested: ${requested} ${uom}\n- Remaining Needed: ${remaining} ${uom}\n- End User: ${vars.endUser || 'Plant'}\n\nPlease issue the remaining balance to the floor.`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 22px 24px; color: #ffffff; text-align: center;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">⚠️ CONSUMABLE PARTIALLY ISSUED</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Velan Metrology Material Governance & Consumables Fulfillment</p>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  The following consumable item has only been <strong>partially issued</strong> to Production. Material balance is still required:
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #1e293b;">
                  <p style="margin: 0 0 8px;"><strong>Item Description:</strong> ${desc}</p>
                  <p style="margin: 0 0 8px;"><strong>PR Number:</strong> ${pr}</p>
                  <p style="margin: 0 0 8px;"><strong>Request Code:</strong> ${reqCode}</p>
                  <p style="margin: 0 0 8px;"><strong>Quantity Already Issued:</strong> ${issued} ${uom}</p>
                  <p style="margin: 0 0 8px;"><strong>Total Requested by Production:</strong> ${requested} ${uom}</p>
                  <p style="margin: 0 0 8px;"><strong>Remaining Balance Needed:</strong> <span style="color: #d97706; font-weight: 700;">${remaining} ${uom}</span></p>
                  <p style="margin: 0;"><strong>End User:</strong> ${escape(vars.endUser || 'Plant Floor')}</p>
                </div>
                <p style="color: #64748b; font-size: 12px; margin-top: 20px;">
                  Please complete shop-floor issuance under <strong>Consumables &gt; Purchase &amp; Store Fulfillment</strong>.
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    MATERIAL_ISSUE_OVERDUE_24H: {
      key: 'MATERIAL_ISSUE_OVERDUE_24H',
      requiredVars: ['rmNumber'],
      allowedVars: ['recipientName', 'rmNumber', 'hoursOverdue', 'reviewedAt', 'designerName', 'itemsSummary', 'actionUrl'],
      render: (vars, escape) => {
        const rm = escape(vars.rmNumber || 'N/A');
        const hours = vars.hoursOverdue !== undefined ? vars.hoursOverdue : '24+';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = vars.actionUrl || `${baseUrl}/stores/rm-issue`;
        return {
          subject: `[V-SMART] OVERDUE: Raw Material Issue Pending (>24h) - ${vars.rmNumber || 'RM Request'}`,
          text: `${name}ALERT: Approved RM Request ${vars.rmNumber || 'N/A'} has not been issued to Production for over ${hours} hours.\nPlease review and issue material at: ${link}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #dc2626; color: white; padding: 16px 24px;">
                <h2 style="margin: 0; font-size: 18px;">⚠️ Material Issue Overdue Alert</h2>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  Approved Raw Material Requisition <strong>${rm}</strong> has been waiting for material issue for <strong>${hours} hours</strong> without fulfillment.
                </p>
                <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #991b1b;">
                  <p style="margin: 0 0 8px;"><strong>RM Request:</strong> ${rm}</p>
                  <p style="margin: 0 0 8px;"><strong>Approved At:</strong> ${escape(vars.reviewedAt || 'N/A')}</p>
                  <p style="margin: 0 0 8px;"><strong>Designer:</strong> ${escape(vars.designerName || 'N/A')}</p>
                  <p style="margin: 0;"><strong>Hours Waiting:</strong> ${hours}h</p>
                </div>
                <p style="margin-top: 20px;">
                  <a href="${link}" style="background: #dc2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; display: inline-block;">
                    View &amp; Issue Material &rarr;
                  </a>
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    DC_PENDING_2_DAYS: {
      key: 'DC_PENDING_2_DAYS',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'dispatchDate', 'createdAt', 'daysPending', 'actionUrl'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const days = vars.daysPending !== undefined ? vars.daysPending : '2+';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = vars.actionUrl || `${baseUrl}/dispatch/movements`;
        return {
          subject: `[V-SMART] OVERDUE: Delivery Challan Not Returned (>2 Days) - ${vars.challanNumber || 'DC'}`,
          text: `${name}ALERT: Delivery Challan ${vars.challanNumber || 'N/A'} was created ${days} days ago and has not been fully returned by vendor ${vars.vendorName || 'N/A'}.\nTrack challan status at: ${link}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #ea580c; color: white; padding: 16px 24px;">
                <h2 style="margin: 0; font-size: 18px;">🚚 Delivery Challan Open Return Alert</h2>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  Delivery Challan <strong>${cn}</strong> dispatched to vendor <strong>${vendor}</strong> was created <strong>${days} days ago</strong> and remains open (not fully returned).
                </p>
                <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #9a3412;">
                  <p style="margin: 0 0 8px;"><strong>Challan Number:</strong> ${cn}</p>
                  <p style="margin: 0 0 8px;"><strong>Vendor:</strong> ${vendor}</p>
                  <p style="margin: 0 0 8px;"><strong>Dispatch Date:</strong> ${escape(vars.dispatchDate || 'N/A')}</p>
                  <p style="margin: 0;"><strong>Days Open:</strong> ${days} days</p>
                </div>
                <p style="margin-top: 20px;">
                  <a href="${link}" style="background: #ea580c; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; display: inline-block;">
                    View Delivery Challan &rarr;
                  </a>
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    CONSUMABLE_PENDING_2_DAYS: {
      key: 'CONSUMABLE_PENDING_2_DAYS',
      requiredVars: ['requestCode'],
      allowedVars: ['recipientName', 'requestCode', 'requestedBy', 'createdAt', 'daysPending', 'itemsCount', 'actionUrl'],
      render: (vars, escape) => {
        const req = escape(vars.requestCode || 'N/A');
        const by = escape(vars.requestedBy || 'N/A');
        const days = vars.daysPending !== undefined ? vars.daysPending : '2+';
        const items = vars.itemsCount !== undefined ? vars.itemsCount : 'N/A';
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = vars.actionUrl || `${baseUrl}/consumables/requests`;
        return {
          subject: `[V-SMART] OVERDUE: Consumable Request Open (>2 Days) - ${vars.requestCode || 'Request'}`,
          text: `${name}ALERT: Consumable Request ${vars.requestCode || 'N/A'} created ${days} days ago by ${vars.requestedBy || 'N/A'} is still pending completion.\nView requests at: ${link}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #d97706; color: white; padding: 16px 24px;">
                <h2 style="margin: 0; font-size: 18px;">📦 Consumable Request Pending Alert</h2>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  Consumable Request <strong>${req}</strong> created <strong>${days} days ago</strong> by <strong>${by}</strong> has not reached completed fulfillment.
                </p>
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 16px 0; font-size: 13px; color: #92400e;">
                  <p style="margin: 0 0 8px;"><strong>Request Code:</strong> ${req}</p>
                  <p style="margin: 0 0 8px;"><strong>Requested By:</strong> ${by}</p>
                  <p style="margin: 0 0 8px;"><strong>Created Date:</strong> ${escape(vars.createdAt || 'N/A')}</p>
                  <p style="margin: 0;"><strong>Line Items Pending:</strong> ${items}</p>
                </div>
                <p style="margin-top: 20px;">
                  <a href="${link}" style="background: #d97706; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; display: inline-block;">
                    View Consumable Requests &rarr;
                  </a>
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    DC_QC_PENDING_24H: {
      key: 'DC_QC_PENDING_24H',
      requiredVars: ['challanNumber'],
      allowedVars: ['recipientName', 'challanNumber', 'vendorName', 'itemsTableHtml', 'itemsCount', 'hoursPending', 'actionUrl'],
      render: (vars, escape) => {
        const cn = escape(vars.challanNumber || 'N/A');
        const vendor = escape(vars.vendorName || 'N/A');
        const count = vars.itemsCount !== undefined ? vars.itemsCount : 1;
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello ${escape(vars.recipientName)},</p>` : '';
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const link = vars.actionUrl || `${baseUrl}/dispatch/returns`;
        const tableHtml = vars.itemsTableHtml || `<p>${count} item(s) pending QC inspection.</p>`;
        return {
          subject: `[V-SMART] QC INSPECTION OVERDUE (>24h): Delivery Challan ${vars.challanNumber || 'DC'}`,
          text: `${name}ALERT: Delivery Challan ${vars.challanNumber || 'N/A'} from vendor ${vars.vendorName || 'N/A'} has ${count} inwarded item(s) waiting for QC inspection for over 24 hours.\nInspect items at: ${link}`,
          html: `
            <div style="font-family: sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #7c3aed; color: white; padding: 16px 24px;">
                <h2 style="margin: 0; font-size: 18px;">🔍 Quality Check (QC) Inspection Overdue Alert</h2>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                  Delivery Challan <strong>${cn}</strong> from vendor <strong>${vendor}</strong> has items inwarded at dock that have been pending Quality Check inspection for <strong>&gt;24 hours</strong>:
                </p>
                <div style="margin: 16px 0;">
                  ${tableHtml}
                </div>
                <p style="margin-top: 20px;">
                  <a href="${link}" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; display: inline-block;">
                    Open QC Inspection Screen &rarr;
                  </a>
                </p>
              </div>
            </div>
          `,
        };
      },
    },

    CONSUMABLE_APPROVAL_REQUESTED: {
      key: 'CONSUMABLE_APPROVAL_REQUESTED',
      requiredVars: ['requestCode'],
      allowedVars: ['recipientName', 'requestCode', 'requestedBy', 'pendingLinesCount', 'items', 'itemsTableHtml', 'actionUrl'],
      render: (vars, escape) => {
        const req = escape(vars.requestCode || 'N/A');
        const by = escape(vars.requestedBy || 'N/A');
        const count = vars.pendingLinesCount !== undefined ? vars.pendingLinesCount : (Array.isArray(vars.items) ? vars.items.length : 1);
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello <strong>${escape(vars.recipientName)}</strong>,</p>` : '';
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
        const link = vars.actionUrl || `${baseUrl}/consumables/approvals`;

        let tableHtml = vars.itemsTableHtml || '';
        let tableText = '';

        if (!tableHtml && Array.isArray(vars.items) && vars.items.length > 0) {
          const displayItems = vars.items.slice(0, 50);
          const overflowCount = vars.items.length - displayItems.length;

          const rowsHtml = displayItems.map((item: any) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${escape(item.requestCode || vars.requestCode || 'N/A')}</td>
              <td style="padding: 8px 12px; color: #334155;">${escape(item.description || 'N/A')}</td>
              <td style="padding: 8px 12px; color: #334155; text-align: right;">${escape(String(item.requestedQty ?? 'N/A'))} ${escape(item.uom || '')}</td>
              <td style="padding: 8px 12px; color: #64748b;">${escape(item.endUserInVelan || 'Plant Floor')}</td>
            </tr>
          `).join('');

          const overflowRowHtml = overflowCount > 0
            ? `<tr><td colspan="4" style="text-align: center; color: #64748b; font-style: italic; padding: 10px; background: #f8fafc;">+ ${overflowCount} more items...</td></tr>`
            : '';

          tableHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">Request Code</th>
                  <th style="padding: 8px 12px;">Item Description</th>
                  <th style="padding: 8px 12px; text-align: right;">Qty</th>
                  <th style="padding: 8px 12px;">Bay / End User</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${overflowRowHtml}
              </tbody>
            </table>
          `;

          tableText = displayItems.map((item: any) =>
            `- ${item.description || 'N/A'} | Qty: ${item.requestedQty ?? 'N/A'} ${item.uom || ''} | Bay: ${item.endUserInVelan || 'Plant Floor'}`
          ).join('\n');
          if (overflowCount > 0) {
            tableText += `\n+ ${overflowCount} more items...`;
          }
        }

        return {
          subject: `[V-SMART] ACTION REQUIRED: Consumable Approval Requested - ${vars.requestCode || 'Requisition'}`,
          text: `${name}ACTION REQUIRED: Consumable Requisition ${req} created by ${by} requires your managerial approval (${count} pending line item(s)).\n\nItems Pending Approval:\n${tableText}\n\nReview and authorize at: ${link}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #d97706 0%, #b45309 100%); padding: 20px 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">🔔 CONSUMABLE REQUISITION APPROVAL REQUIRED</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">Senior Manager & Admin Governance Gate</p>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
                  Consumable Requisition <strong>${req}</strong> raised by <strong>${by}</strong> contains <strong>${count}</strong> item(s) awaiting managerial authorization:
                </p>
                ${tableHtml}
                <div style="margin-top: 24px; text-align: center;">
                  <a href="${link}" style="background: #d97706; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
                    Review & Authorize in SM Approvals &rarr;
                  </a>
                </div>
              </div>
            </div>
          `,
        };
      },
    },

    CONSUMABLE_APPROVED: {
      key: 'CONSUMABLE_APPROVED',
      requiredVars: ['itemsCount'],
      allowedVars: ['recipientName', 'batchId', 'itemsCount', 'items', 'itemsTableHtml', 'actionUrl', 'recipientRole', 'switchedCount'],
      render: (vars, escape) => {
        const count = vars.itemsCount !== undefined ? vars.itemsCount : (Array.isArray(vars.items) ? vars.items.length : 1);
        const switchedCount = Number(vars.switchedCount || 0);
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello <strong>${escape(vars.recipientName)}</strong>,</p>` : '';
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
        const defaultLink = vars.recipientRole === 'STORES'
          ? `${baseUrl}/consumables/purchase-store`
          : `${baseUrl}/consumables/requests`;
        const link = vars.actionUrl || defaultLink;

        let tableHtml = vars.itemsTableHtml || '';
        let tableText = '';

        if (!tableHtml && Array.isArray(vars.items) && vars.items.length > 0) {
          const displayItems = vars.items.slice(0, 50);
          const overflowCount = vars.items.length - displayItems.length;

          const rowsHtml = displayItems.map((item: any) => {
            const isSwitched = Boolean(item.isSwitchedToPurchase);
            const trackLabel = isSwitched
              ? '<span style="background: #fef3c7; color: #92400e; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600;">Purchase Track (Stock Depleted)</span>'
              : (item.itemCategoryTrack === 'STOCK_ITEM'
                  ? '<span style="background: #ecfdf5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-size: 11px;">In-Stock Store</span>'
                  : '<span style="background: #eff6ff; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 11px;">Purchase Track</span>');

            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${escape(item.requestCode || 'N/A')}</td>
                <td style="padding: 8px 12px; color: #334155;">${escape(item.description || 'N/A')}</td>
                <td style="padding: 8px 12px; color: #334155; text-align: right;">${escape(String(item.requestedQty ?? 'N/A'))} ${escape(item.uom || '')}</td>
                <td style="padding: 8px 12px; color: #64748b;">${escape(item.endUserInVelan || 'Plant Floor')}</td>
                <td style="padding: 8px 12px;">${trackLabel}</td>
              </tr>
            `;
          }).join('');

          const overflowRowHtml = overflowCount > 0
            ? `<tr><td colspan="5" style="text-align: center; color: #64748b; font-style: italic; padding: 10px; background: #f8fafc;">+ ${overflowCount} more items...</td></tr>`
            : '';

          tableHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">Request Code</th>
                  <th style="padding: 8px 12px;">Item Description</th>
                  <th style="padding: 8px 12px; text-align: right;">Qty</th>
                  <th style="padding: 8px 12px;">Bay / End User</th>
                  <th style="padding: 8px 12px;">Track</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${overflowRowHtml}
              </tbody>
            </table>
          `;

          tableText = displayItems.map((item: any) =>
            `- [${item.requestCode || 'N/A'}] ${item.description || 'N/A'} | Qty: ${item.requestedQty ?? 'N/A'} ${item.uom || ''} | Track: ${item.isSwitchedToPurchase ? 'Purchase Track (Stock Depleted)' : (item.itemCategoryTrack || 'Standard')} | Bay: ${item.endUserInVelan || 'Plant Floor'}`
          ).join('\n');
          if (overflowCount > 0) {
            tableText += `\n+ ${overflowCount} more items...`;
          }
        }

        const switchedBannerHtml = switchedCount > 0
          ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #92400e;">
               <strong>⚠️ Track Switching Notice:</strong> ${switchedCount} item(s) had available store stock depleted during approval and were dynamically routed to the <strong>Purchase Track</strong> for procurement.
             </div>`
          : '';

        const switchedBannerText = switchedCount > 0
          ? `NOTE: ${switchedCount} item(s) had store stock depleted and were automatically switched to the Purchase Track.\n\n`
          : '';

        return {
          subject: `[V-SMART] APPROVED: Consumable Request Items Approved (${count} item${count > 1 ? 's' : ''})`,
          text: `${name}NOTIFICATION: ${count} consumable line item(s) have been APPROVED by Senior Management.\n\n${switchedBannerText}Approved Items:\n${tableText}\n\nTrack progress at: ${link}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 20px 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">✅ CONSUMABLE REQUISITION ITEMS APPROVED</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">Fulfillment Authorization Confirmed</p>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
                  Senior Management has authorized the following <strong>${count}</strong> consumable line item(s):
                </p>
                ${switchedBannerHtml}
                ${tableHtml}
                <div style="margin-top: 24px; text-align: center;">
                  <a href="${link}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
                    View Fulfillment Queue &rarr;
                  </a>
                </div>
              </div>
            </div>
          `,
        };
      },
    },

    CONSUMABLE_REJECTED: {
      key: 'CONSUMABLE_REJECTED',
      requiredVars: ['itemsCount'],
      allowedVars: ['recipientName', 'batchId', 'itemsCount', 'items', 'itemsTableHtml', 'actionUrl', 'rejectionReason'],
      render: (vars, escape) => {
        const count = vars.itemsCount !== undefined ? vars.itemsCount : (Array.isArray(vars.items) ? vars.items.length : 1);
        const name = vars.recipientName ? `Hello ${escape(vars.recipientName)},\n\n` : '';
        const htmlName = vars.recipientName ? `<p>Hello <strong>${escape(vars.recipientName)}</strong>,</p>` : '';
        const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',')[0].trim();
        const link = vars.actionUrl || `${baseUrl}/consumables/requests`;

        let tableHtml = vars.itemsTableHtml || '';
        let tableText = '';

        if (!tableHtml && Array.isArray(vars.items) && vars.items.length > 0) {
          const displayItems = vars.items.slice(0, 50);
          const overflowCount = vars.items.length - displayItems.length;

          const rowsHtml = displayItems.map((item: any) => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 12px; font-weight: 600; color: #1e293b;">${escape(item.requestCode || 'N/A')}</td>
              <td style="padding: 8px 12px; color: #334155;">${escape(item.description || 'N/A')}</td>
              <td style="padding: 8px 12px; color: #334155; text-align: right;">${escape(String(item.requestedQty ?? 'N/A'))} ${escape(item.uom || '')}</td>
              <td style="padding: 8px 12px; color: #64748b;">${escape(item.endUserInVelan || 'Plant Floor')}</td>
              <td style="padding: 8px 12px; color: #b91c1c; font-weight: 500;">${escape(item.rejectionReason || vars.rejectionReason || 'Not approved')}</td>
            </tr>
          `).join('');

          const overflowRowHtml = overflowCount > 0
            ? `<tr><td colspan="5" style="text-align: center; color: #64748b; font-style: italic; padding: 10px; background: #f8fafc;">+ ${overflowCount} more items...</td></tr>`
            : '';

          tableHtml = `
            <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
              <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-size: 11px; text-transform: uppercase;">
                  <th style="padding: 8px 12px;">Request Code</th>
                  <th style="padding: 8px 12px;">Item Description</th>
                  <th style="padding: 8px 12px; text-align: right;">Qty</th>
                  <th style="padding: 8px 12px;">Bay / End User</th>
                  <th style="padding: 8px 12px;">Rejection Reason</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
                ${overflowRowHtml}
              </tbody>
            </table>
          `;

          tableText = displayItems.map((item: any) =>
            `- [${item.requestCode || 'N/A'}] ${item.description || 'N/A'} | Qty: ${item.requestedQty ?? 'N/A'} ${item.uom || ''} | Reason: ${item.rejectionReason || vars.rejectionReason || 'Not approved'}`
          ).join('\n');
          if (overflowCount > 0) {
            tableText += `\n+ ${overflowCount} more items...`;
          }
        }

        return {
          subject: `[V-SMART] REJECTED: Consumable Request Line Items Not Approved (${count} item${count > 1 ? 's' : ''})`,
          text: `${name}NOTICE: The following ${count} consumable line item(s) were REJECTED by Senior Management.\n\nRejected Items:\n${tableText}\n\nYou may review details or re-raise with corrected parameters at: ${link}`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
              <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 20px 24px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">❌ CONSUMABLE REQUISITION ITEMS REJECTED</h2>
                <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.95;">Managerial Rejection Notification</p>
              </div>
              <div style="padding: 24px;">
                ${htmlName}
                <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-top: 0;">
                  Senior Management has <strong>not approved</strong> the following <strong>${count}</strong> item(s). Specific feedback has been recorded for each line below:
                </p>
                ${tableHtml}
                <div style="margin-top: 24px; text-align: center;">
                  <a href="${link}" style="background: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
                    Open Requisition Workspace / Re-raise &rarr;
                  </a>
                </div>
              </div>
            </div>
          `,
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
