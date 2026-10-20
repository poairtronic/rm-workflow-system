export type CanonicalStage =
  | 'Draft'
  | 'Design Issued'
  | 'Stores Pending'
  | 'Partially Issued'
  | 'Stores Issued'
  | 'Production Pending'
  | 'Production Received';

export const CANONICAL_STAGES: CanonicalStage[] = [
  'Draft',
  'Design Issued',
  'Stores Pending',
  'Partially Issued',
  'Stores Issued',
  'Production Pending',
  'Production Received',
];

export const STAGE_CONFIG: Record<
  CanonicalStage,
  {
    label: CanonicalStage;
    variant: 'neutral' | 'info' | 'warning' | 'purple' | 'blue' | 'indigo' | 'success';
    badgeClass: string;
    hexColor: string;
    description: string;
  }
> = {
  'Draft': {
    label: 'Draft',
    variant: 'neutral',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
    hexColor: '#94a3b8',
    description: 'Component initialized in draft mode',
  },
  'Design Issued': {
    label: 'Design Issued',
    variant: 'info',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    hexColor: '#0ea5e9',
    description: 'Design BOM / RM specifications finalized and released',
  },
  'Stores Pending': {
    label: 'Stores Pending',
    variant: 'warning',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    hexColor: '#f59e0b',
    description: 'Awaiting raw material issue from warehouse stores',
  },
  'Partially Issued': {
    label: 'Partially Issued',
    variant: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    hexColor: '#8b5cf6',
    description: 'Stores has dispatched partial raw materials; balance pending',
  },
  'Stores Issued': {
    label: 'Stores Issued',
    variant: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    hexColor: '#3b82f6',
    description: 'Stores has completely issued required raw materials',
  },
  'Production Pending': {
    label: 'Production Pending',
    variant: 'indigo',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    hexColor: '#6366f1',
    description: 'Material dispatched from stores, awaiting shop floor receipt',
  },
  'Production Received': {
    label: 'Production Received',
    variant: 'success',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    hexColor: '#10b981',
    description: 'Shop floor production has received and acknowledged materials',
  },
};

/**
 * Maps an SC (or status string + optional issue/receipt quantities) to strictly one of the 7 canonical stages.
 */
export function getCanonicalStage(item?: {
  status?: string;
  totalIssued?: number;
  totalRequired?: number;
  totalReceived?: number;
  hasReceipt?: boolean;
  hasIssue?: boolean;
  isPartiallyIssued?: boolean;
  materialIssues?: any[];
  materialReceipts?: any[];
} | string): CanonicalStage {
  if (!item) return 'Draft';

  let rawStatus = '';
  let totalIssued: number | undefined;
  let totalRequired: number | undefined;
  let totalReceived: number | undefined;
  let hasReceipt: boolean | undefined;
  let isPartiallyIssued: boolean | undefined;

  if (typeof item === 'string') {
    rawStatus = item.toUpperCase().trim();
  } else {
    rawStatus = (item.status || '').toUpperCase().trim();
    totalIssued = item.totalIssued;
    totalRequired = item.totalRequired;
    totalReceived = item.totalReceived;
    hasReceipt = item.hasReceipt || (item.materialReceipts && item.materialReceipts.length > 0);
    isPartiallyIssued = item.isPartiallyIssued;
  }

  // 1. Partial issue detection
  if (
    isPartiallyIssued ||
    rawStatus === 'PARTIALLY_ISSUED' ||
    rawStatus === 'PARTIALLY ISSUED' ||
    rawStatus === 'PARTIAL_ISSUE' ||
    (totalIssued !== undefined && totalRequired !== undefined && totalIssued > 0 && totalIssued < totalRequired)
  ) {
    return 'Partially Issued';
  }

  // 2. Draft
  if (rawStatus === 'DRAFT' || rawStatus === 'PENDING') {
    return 'Draft';
  }

  // 3. Design Issued
  if (rawStatus === 'DESIGN_ISSUED' || rawStatus === 'DESIGN ISSUED' || rawStatus === 'SUBMITTED') {
    return 'Design Issued';
  }

  // 4. Stores Pending
  if (rawStatus === 'STORES_PENDING' || rawStatus === 'STORES PENDING') {
    return 'Stores Pending';
  }

  // 5. Production Received (explicit or completed or in production with receipts)
  if (
    rawStatus === 'PRODUCTION_RECEIVED' ||
    rawStatus === 'PRODUCTION RECEIVED' ||
    rawStatus === 'IN_PRODUCTION' ||
    rawStatus === 'IN PRODUCTION' ||
    rawStatus === 'COMPLETED' ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'ADDITIONAL_REQUEST'
  ) {
    if (totalIssued !== undefined && totalIssued > 0 && totalReceived !== undefined && totalReceived === 0) {
      return 'Production Pending';
    }
    return 'Production Received';
  }

  // 6. Stores Issued / Production Pending
  if (
    rawStatus === 'ISSUED' ||
    rawStatus === 'STORES_ISSUED' ||
    rawStatus === 'STORES ISSUED'
  ) {
    if (hasReceipt || (totalReceived !== undefined && totalReceived > 0)) {
      return 'Production Received';
    }
    if (totalIssued !== undefined && totalIssued > 0) {
      return 'Production Pending';
    }
    return 'Stores Issued';
  }

  if (rawStatus === 'PRODUCTION_PENDING' || rawStatus === 'PRODUCTION PENDING') {
    return 'Production Pending';
  }

  // 7. General fallbacks
  if (rawStatus.includes('DRAFT')) return 'Draft';
  if (rawStatus.includes('DESIGN')) return 'Design Issued';
  if (rawStatus.includes('STORES_PEND') || rawStatus.includes('STORES PEND')) return 'Stores Pending';
  if (rawStatus.includes('PARTIAL')) return 'Partially Issued';
  if (rawStatus.includes('STORES_ISS') || rawStatus.includes('STORES ISS')) return 'Stores Issued';
  if (rawStatus.includes('PROD_PEND') || rawStatus.includes('PROD PEND')) return 'Production Pending';
  if (rawStatus.includes('PROD') || rawStatus.includes('RECEIV') || rawStatus.includes('COMPLET') || rawStatus.includes('CLOSE')) {
    return 'Production Received';
  }

  return 'Draft';
}

/**
 * Computes the generalized overall stage for a Purchase Order based on its child SCs.
 * Follows the 7-stage manufacturing progression hierarchy.
 */
export function getGeneralizedPoStage(
  scs: Array<{ status?: string; [key: string]: any }> = []
): CanonicalStage {
  if (!scs || scs.length === 0) return 'Draft';

  const stages = scs.map(sc => getCanonicalStage(sc));

  // If all SCs share the same stage, return that stage
  if (stages.every(s => s === stages[0])) {
    return stages[0];
  }

  // Progression priority:
  // If any component has reached production received, the overall PO is actively in Production Received
  if (stages.some(s => s === 'Production Received')) return 'Production Received';
  if (stages.some(s => s === 'Production Pending')) return 'Production Pending';
  if (stages.some(s => s === 'Stores Issued')) return 'Stores Issued';
  if (stages.some(s => s === 'Partially Issued')) return 'Partially Issued';
  if (stages.some(s => s === 'Stores Pending')) return 'Stores Pending';
  if (stages.some(s => s === 'Design Issued')) return 'Design Issued';

  return 'Draft';
}
