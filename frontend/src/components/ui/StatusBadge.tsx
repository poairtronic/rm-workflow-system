import { cn } from '../../utils/cn';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
};

// SC Statuses
const scStatusMap: Record<string, BadgeVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  STORES_PENDING: 'warning',
  PARTIALLY_ISSUED: 'info',
  ISSUED: 'success',
  IN_PRODUCTION: 'info',
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
  LOW: 'warning',
  CRITICAL: 'error',
};

// SLA State
const slaStateMap: Record<string, BadgeVariant> = {
  ON_TRACK: 'success',
  DUE_TODAY: 'warning',
  OVERDUE: 'error',
};

const allStatusMaps = {
  ...scStatusMap,
  ...rmRequestStatusMap,
  ...dcStatusMap,
  ...arStatusMap,
  ...stockSeverityMap,
  ...slaStateMap,
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = (status || '').toUpperCase();
  const variant = allStatusMaps[normalizedStatus] || 'neutral';
  
  // Format text: replace underscores with spaces, Title Case
  const formattedText = normalizedStatus
    .split('_')
    .map(word => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        variantClasses[variant],
        className
      )}
    >
      {formattedText || status || 'Unknown'}
    </span>
  );
}
