export const WORKFLOW_STATUS_CONFIG: Record<
  string,
  { label: string; symbol: string; badgeClass: string }
> = {
  DRAFT: { label: 'Draft', symbol: '●', badgeClass: 'badge-draft' },
  SUBMITTED: { label: 'Submitted to Stores', symbol: '↑', badgeClass: 'badge-submitted' },
  STORES_PENDING: { label: 'Pending Stores', symbol: '!', badgeClass: 'badge-pending' },
  PARTIALLY_ISSUED: {
    label: 'Partially Issued',
    symbol: '⚠',
    badgeClass: 'badge-partial',
  },
  ISSUED: { label: 'Issued', symbol: '✓', badgeClass: 'badge-issued' },
  RECEIVED: { label: 'Received', symbol: '✓', badgeClass: 'badge-received' },
  IN_PRODUCTION: { label: 'In Production', symbol: '⚙', badgeClass: 'badge-active' },
  ADDITIONAL_REQUEST: {
    label: 'Additional Request',
    symbol: '↻',
    badgeClass: 'badge-additional',
  },
  COMPLETED: { label: 'Completed', symbol: '✓', badgeClass: 'badge-success' },
};
