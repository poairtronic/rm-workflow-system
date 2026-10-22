export type CanonicalStage =
  | 'Draft'
  | 'Stores Pending'
  | 'Stores Issued Partially'
  | 'Stores Issued'
  | 'Production Received';

export const CANONICAL_STAGES: CanonicalStage[] = [
  'Draft',
  'Stores Pending',
  'Stores Issued Partially',
  'Stores Issued',
  'Production Received',
];

export const STAGE_CONFIG: Record<
  CanonicalStage,
  {
    label: CanonicalStage;
    variant: 'neutral' | 'warning' | 'purple' | 'blue' | 'success';
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
    description: 'Pending with design',
  },
  'Stores Pending': {
    label: 'Stores Pending',
    variant: 'warning',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    hexColor: '#f59e0b',
    description: 'Design completed and pending with stores',
  },
  'Stores Issued Partially': {
    label: 'Stores Issued Partially',
    variant: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    hexColor: '#8b5cf6',
    description: 'Stores issued partial materials only and pending with stores only',
  },
  'Stores Issued': {
    label: 'Stores Issued',
    variant: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    hexColor: '#3b82f6',
    description: 'Stores has issued and production not yet received',
  },
  'Production Received': {
    label: 'Production Received',
    variant: 'success',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    hexColor: '#10b981',
    description: 'Production received the material completely',
  },
};

/**
 * Maps an SC (or status string + optional issue/receipt quantities) to strictly one of the 5 canonical stages.
 * 1. Draft: pending with design
 * 2. Stores Pending: design completed and pending with stores
 * 3. Stores Issued Partially: stores issued partial materials only and pending with stores only
 * 4. Stores Issued: stores has issued and production not yet received
 * 5. Production Received: production received the material completely
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

  // 1. Stores Issued Partially: stores issued partial materials only and pending with stores only
  if (
    isPartiallyIssued ||
    rawStatus === 'PARTIALLY_ISSUED' ||
    rawStatus === 'PARTIALLY ISSUED' ||
    rawStatus === 'PARTIAL_ISSUE' ||
    rawStatus === 'STORES_ISSUED_PARTIALLY' ||
    rawStatus === 'STORES ISSUED PARTIALLY' ||
    (totalIssued !== undefined && totalRequired !== undefined && totalIssued > 0 && totalIssued < totalRequired)
  ) {
    return 'Stores Issued Partially';
  }

  // 2. Draft: pending with design
  if (rawStatus === 'DRAFT' || rawStatus === 'PENDING') {
    return 'Draft';
  }

  // 3. Stores Pending: design completed and pending with stores
  if (
    rawStatus === 'STORES_PENDING' ||
    rawStatus === 'STORES PENDING' ||
    rawStatus === 'DESIGN_ISSUED' ||
    rawStatus === 'DESIGN ISSUED' ||
    rawStatus === 'SUBMITTED'
  ) {
    return 'Stores Pending';
  }

  // 4. Stores Issued: stores has issued and production not yet received
  if (
    rawStatus === 'ISSUED' ||
    rawStatus === 'STORES_ISSUED' ||
    rawStatus === 'STORES ISSUED' ||
    rawStatus === 'PRODUCTION_PENDING' ||
    rawStatus === 'PRODUCTION PENDING'
  ) {
    // If complete receipt acknowledged by production
    if (
      (totalIssued !== undefined && totalIssued > 0 && totalReceived !== undefined && totalReceived >= totalIssued) ||
      (hasReceipt && (totalReceived === undefined || totalReceived > 0) && totalIssued === undefined)
    ) {
      return 'Production Received';
    }
    return 'Stores Issued';
  }

  // 5. Production Received: production received the material completely
  if (
    rawStatus === 'PRODUCTION_RECEIVED' ||
    rawStatus === 'PRODUCTION RECEIVED' ||
    rawStatus === 'IN_PRODUCTION' ||
    rawStatus === 'IN PRODUCTION' ||
    rawStatus === 'COMPLETED' ||
    rawStatus === 'CLOSED' ||
    rawStatus === 'ADDITIONAL_REQUEST'
  ) {
    // If explicit quantities show stores issued but production has received 0, it is still pending receipt
    if (totalIssued !== undefined && totalIssued > 0 && totalReceived !== undefined && totalReceived === 0) {
      return 'Stores Issued';
    }
    return 'Production Received';
  }

  // General fallbacks
  if (rawStatus.includes('DRAFT')) return 'Draft';
  if (rawStatus.includes('DESIGN') || rawStatus.includes('STORES_PEND') || rawStatus.includes('STORES PEND') || rawStatus.includes('SUBMIT')) {
    return 'Stores Pending';
  }
  if (rawStatus.includes('PARTIAL')) return 'Stores Issued Partially';
  if (rawStatus.includes('STORES_ISS') || rawStatus.includes('STORES ISS') || rawStatus.includes('PROD_PEND') || rawStatus.includes('PROD PEND') || rawStatus === 'ISSUED') {
    return 'Stores Issued';
  }
  if (rawStatus.includes('PROD') || rawStatus.includes('RECEIV') || rawStatus.includes('COMPLET') || rawStatus.includes('CLOSE')) {
    return 'Production Received';
  }

  return 'Draft';
}

/**
 * Computes the generalized overall stage for a Purchase Order based on its child SCs.
 * Follows the 5-stage manufacturing progression hierarchy.
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
  if (stages.some(s => s === 'Production Received')) return 'Production Received';
  if (stages.some(s => s === 'Stores Issued')) return 'Stores Issued';
  if (stages.some(s => s === 'Stores Issued Partially')) return 'Stores Issued Partially';
  if (stages.some(s => s === 'Stores Pending')) return 'Stores Pending';

  return 'Draft';
}
