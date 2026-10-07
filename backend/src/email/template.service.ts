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
          subject: `[RMRIT Alert] Low Stock Warning: ${prod}`,
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
          subject: `[RMRIT Alert] CRITICAL: OUT OF STOCK: ${prod}`,
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
          subject: `[RMRIT Notice] Stock Restored: ${prod}`,
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
          subject: `[RMRIT Notification] Material Received: ${scNum}`,
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
          subject: `[RMRIT Notification] Material Return Submitted: ${scNum}`,
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
          subject: `[RMRIT Notification] Material Return Acknowledged: ${scNum}`,
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
          subject: `[RMRIT Notification] Additional Material Approved: ${scNum}`,
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
          subject: `[RMRIT Notification] Additional Material Rejected: ${scNum}`,
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
          subject: `[RMRIT Notification] Additional Material Issued: ${scNum}`,
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
          subject: `[RMRIT] Delivery Challan Created: ${vars.challanNumber || 'N/A'}`,
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
          subject: `[RMRIT] Delivery Challan Dispatched: ${vars.challanNumber || 'N/A'}`,
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
          subject: `[RMRIT] SLA Alert: Challan ${vars.challanNumber || 'N/A'} approaching return deadline`,
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
          subject: `[RMRIT] OVERDUE: Delivery Challan ${vars.challanNumber || 'N/A'} not returned`,
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
          subject: `[RMRIT] Partial Return Received: Challan ${vars.challanNumber || 'N/A'}`,
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
          subject: `[RMRIT] Challan Fully Returned: ${vars.challanNumber || 'N/A'}`,
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
          subject: `[RMRIT] Delivery Challan Closed: ${vars.challanNumber || 'N/A'}`,
          text: `${name}Delivery Challan ${vars.challanNumber || 'N/A'} with vendor ${vars.vendorName || 'N/A'} has been administratively closed.`,
          html: `<h3>Delivery Challan Closed</h3>${htmlName}<p>Challan <strong>${cn}</strong> with vendor <strong>${vendor}</strong> has been administratively closed and archived.</p>`,
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
