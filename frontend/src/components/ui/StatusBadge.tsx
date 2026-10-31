import { cn } from '../../utils/cn';
import { STAGE_CONFIG } from '../../utils/canonicalStages';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  warning: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  error: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
  info: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-indigo-500/15 dark:text-indigo-400 dark:border-indigo-500/30',
  neutral: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50',
};

// 5 Canonical Stage badge classes & legacy aliases
const canonicalBadgeMap: Record<string, { label: string; className: string }> = {
  // 1. Draft
  'DRAFT': { label: 'Draft', className: STAGE_CONFIG['Draft'].badgeClass },

  // 2. Stores Pending (design completed and pending with stores)
  'STORES_PENDING': { label: 'Stores Pending', className: STAGE_CONFIG['Stores Pending'].badgeClass },
  'STORES PENDING': { label: 'Stores Pending', className: STAGE_CONFIG['Stores Pending'].badgeClass },
  'DESIGN_ISSUED': { label: 'Stores Pending', className: STAGE_CONFIG['Stores Pending'].badgeClass },
  'DESIGN ISSUED': { label: 'Stores Pending', className: STAGE_CONFIG['Stores Pending'].badgeClass },
  'SUBMITTED': { label: 'Stores Pending', className: STAGE_CONFIG['Stores Pending'].badgeClass },

  // 3. Stores Issued Partially (stores issued partial materials only and pending with stores only)
  'STORES_ISSUED_PARTIALLY': { label: 'Stores Issued Partially', className: STAGE_CONFIG['Stores Issued Partially'].badgeClass },
  'STORES ISSUED PARTIALLY': { label: 'Stores Issued Partially', className: STAGE_CONFIG['Stores Issued Partially'].badgeClass },
  'PARTIALLY_ISSUED': { label: 'Stores Issued Partially', className: STAGE_CONFIG['Stores Issued Partially'].badgeClass },
  'PARTIALLY ISSUED': { label: 'Stores Issued Partially', className: STAGE_CONFIG['Stores Issued Partially'].badgeClass },
  'PARTIAL_ISSUE': { label: 'Stores Issued Partially', className: STAGE_CONFIG['Stores Issued Partially'].badgeClass },

  // 4. Stores Issued (stores has issued and production not yet received)
  'STORES_ISSUED': { label: 'Stores Issued', className: STAGE_CONFIG['Stores Issued'].badgeClass },
  'STORES ISSUED': { label: 'Stores Issued', className: STAGE_CONFIG['Stores Issued'].badgeClass },
  'ISSUED': { label: 'Stores Issued', className: STAGE_CONFIG['Stores Issued'].badgeClass },
  'PRODUCTION_PENDING': { label: 'Stores Issued', className: STAGE_CONFIG['Stores Issued'].badgeClass },
  'PRODUCTION PENDING': { label: 'Stores Issued', className: STAGE_CONFIG['Stores Issued'].badgeClass },

  // 5. Production Received (production received the material completely)
  'PRODUCTION_RECEIVED': { label: 'Production Received', className: STAGE_CONFIG['Production Received'].badgeClass },
  'PRODUCTION RECEIVED': { label: 'Production Received', className: STAGE_CONFIG['Production Received'].badgeClass },
  'IN_PRODUCTION': { label: 'Production Received', className: STAGE_CONFIG['Production Received'].badgeClass },
  'IN PRODUCTION': { label: 'Production Received', className: STAGE_CONFIG['Production Received'].badgeClass },
};

// SC Statuses
const scStatusMap: Record<string, BadgeVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  STORES_PENDING: 'warning',
  PARTIALLY_ISSUED: 'info',
  ISSUED: 'info',
  IN_PRODUCTION: 'success',
  ADDITIONAL_REQUEST: 'warning',
  COMPLETED: 'success',
  CLOSED: 'neutral',
};

// RM Request Statuses
const rmRequestStatusMap: Record<string, BadgeVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  REVIEWED: 'info',
  COMPLETED: 'success',
};

// DC Statuses
const dcStatusMap: Record<string, BadgeVariant> = {
  OPEN: 'info',
  DISPATCHED: 'info',
  PARTIALLY_RETURNED: 'warning',
  RETURNED: 'success',
  CLOSED: 'neutral',
};

// Additional Request Statuses
const arStatusMap: Record<string, BadgeVariant> = {
  REQUESTED: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  ISSUED: 'success',
  CANCELLED: 'neutral',
};

// Stock Severity
const stockSeverityMap: Record<string, BadgeVariant> = {
  OK: 'success',
  GOOD: 'success',
  NORMAL: 'success',
  LOW: 'warning',
  LOW_STOCK: 'warning',
  BELOW_MSL: 'warning',
  CRITICAL: 'error',
  OUT_OF_STOCK: 'error',
  DEFICIT: 'error',
};

// SLA State
const slaStateMap: Record<string, BadgeVariant> = {
  ON_TRACK: 'success',
  DUE_TODAY: 'warning',
  OVERDUE: 'error',
};

// User & Entity Statuses
const userStatusMap: Record<string, BadgeVariant> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
  ADMIN: 'error',
  DESIGNER: 'info',
  STORES: 'warning',
  PRODUCTION: 'info',
  SENIOR_MANAGER: 'info',
  GENERAL_MANAGER: 'success',
};

// Transaction Types
const transactionTypeCustomClasses: Record<string, string> = {
  GRN_RECEIPT: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold',
  DC_DISPATCH: 'bg-amber-100 text-amber-800 border-amber-300 font-semibold',
  DC_RETURN: 'bg-indigo-100 text-indigo-800 border-indigo-300 font-semibold',
  PRODUCTION_CONSUMPTION: 'bg-purple-100 text-purple-800 border-purple-300 font-semibold',
  STOCK_IN: 'bg-green-100 text-green-800 border-green-200',
  STOCK_OUT: 'bg-rose-100 text-rose-800 border-rose-200',
  STORES_ISSUE: 'bg-orange-100 text-orange-800 border-orange-200',
  RETURN: 'bg-teal-100 text-teal-800 border-teal-200',
  ADJUSTMENT: 'bg-slate-100 text-slate-800 border-slate-200',
  TRANSFER: 'bg-sky-100 text-sky-800 border-sky-200',
};

const allStatusMaps = {
  ...scStatusMap,
  ...rmRequestStatusMap,
  ...dcStatusMap,
  ...arStatusMap,
  ...stockSeverityMap,
  ...slaStateMap,
  ...userStatusMap,
};

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

export function StatusBadge({ status, variant: explicitVariant, className }: StatusBadgeProps) {
  const normalizedStatus = (status || '').toUpperCase().trim();
  const canonical = canonicalBadgeMap[normalizedStatus];

  if (canonical) {
    return (
      <span
        className={cn(
          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs whitespace-nowrap shrink-0",
          canonical.className,
          className
        )}
      >
        {canonical.label}
      </span>
    );
  }

  const customClass = transactionTypeCustomClasses[normalizedStatus];
  const variant = explicitVariant || allStatusMaps[normalizedStatus] || 'neutral';
  
  // Format text: replace underscores with spaces, Title Case
  const formattedText = normalizedStatus
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0",
        customClass || variantClasses[variant],
        className
      )}
    >
      {formattedText || status || 'Unknown'}
    </span>
  );
}
