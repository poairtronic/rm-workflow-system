export const WORKFLOW_STATUS_CONFIG: Record<
  string,
  { label: string; symbol: string; badgeClass: string }
> = {
  DRAFT: { label: 'Draft', symbol: '●', badgeClass: 'badge-draft' },
  SUBMITTED: { label: 'Stores Pending', symbol: '!', badgeClass: 'badge-pending' },
  STORES_PENDING: { label: 'Stores Pending', symbol: '!', badgeClass: 'badge-pending' },
  PARTIALLY_ISSUED: {
    label: 'Stores Issued Partially',
    symbol: '⚠',
    badgeClass: 'badge-partial',
  },
  STORES_ISSUED_PARTIALLY: {
    label: 'Stores Issued Partially',
    symbol: '⚠',
    badgeClass: 'badge-partial',
  },
  ISSUED: { label: 'Stores Issued', symbol: '✓', badgeClass: 'badge-issued' },
  STORES_ISSUED: { label: 'Stores Issued', symbol: '✓', badgeClass: 'badge-issued' },
  PRODUCTION_PENDING: { label: 'Stores Issued', symbol: '✓', badgeClass: 'badge-issued' },
  RECEIVED: { label: 'Production Received', symbol: '✓', badgeClass: 'badge-received' },
  PRODUCTION_RECEIVED: { label: 'Production Received', symbol: '✓', badgeClass: 'badge-received' },
  IN_PRODUCTION: { label: 'Production Received', symbol: '⚙', badgeClass: 'badge-active' },
  ADDITIONAL_REQUEST: {
    label: 'Stores Issued',
    symbol: '↻',
    badgeClass: 'badge-additional',
  },
  COMPLETED: { label: 'Production Received', symbol: '✓', badgeClass: 'badge-success' },
};
