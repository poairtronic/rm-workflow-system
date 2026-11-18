/**
 * Canonical Enterprise Email Priority Classification
 * Priority 1: User-triggered operational workflows & security auth (immune to budget reserve line)
 * Priority 5: System diagnostic, admin test sends, event-driven inventory triggers
 * Priority 9: Scheduled hourly sweeps & consolidated multi-item alert digests
 */

export const EVENT_PRIORITY_MAP: Record<string, number> = {
  // Priority 1: User-triggered transactional workflows & password resets
  RM_SUBMITTED: 1,
  MATERIAL_ISSUED: 1,
  ADDITIONAL_REQUEST: 1,
  ADDITIONAL_MATERIAL_REQUESTED: 1,
  SC_COMPLETED: 1,
  MATERIAL_RECEIVED: 1,
  MATERIAL_RETURNED: 1,
  RETURN_VERIFIED: 1,
  EXTRA_MATERIAL_APPROVED: 1,
  EXTRA_MATERIAL_REJECTED: 1,
  EXTRA_MATERIAL_ISSUED: 1,
  DC_CREATED: 1,
  DC_DISPATCHED: 1,
  DC_PARTIALLY_RETURNED: 1,
  DC_RETURNED: 1,
  DC_CLOSED: 1,
  PASSWORD_RESET: 1,
  CONSUMABLE_APPROVAL_REQUESTED: 1,
  CONSUMABLE_APPROVED: 1,
  CONSUMABLE_REJECTED: 1,

  // Priority 5: Administrative, diagnostic & event-driven stock triggers
  TEST_EMAIL: 5,

  // Priority 9: Automated sweeps and digest alerts
  CONSUMABLE_RECEIPT_OVERDUE: 9,
  CONSUMABLE_PARTIALLY_ISSUED_OVERDUE: 9,
  MATERIAL_ISSUE_OVERDUE_24H: 9,
  DC_PENDING_2_DAYS: 9,
  CONSUMABLE_PENDING_2_DAYS: 9,
  DC_QC_PENDING_24H: 9,
  DC_APPROACHING_SLA: 9,
  DC_OVERDUE: 9,
  MSL_LOW_STOCK: 9,
  MSL_OUT_OF_STOCK: 9,
  ALERT_DIGEST: 9,
};

/**
 * Resolves priority for an outgoing email event.
 * Handles dynamic differentiation:
 * - MSL_LOW_STOCK / MSL_OUT_OF_STOCK:
 *     Sweep-driven (isSweep = true) -> Priority 9
 *     Stock transaction event-driven (isSweep = false / undefined) -> Priority 5
 * - Unclassified events default to Priority 5 at runtime.
 */
export function resolveEventPriority(
  eventType: string,
  payloadOrMetadata?: Record<string, any>,
): number {
  if (!eventType) {
    return 5;
  }

  // Differentiate MSL alert triggers
  if (eventType === 'MSL_LOW_STOCK' || eventType === 'MSL_OUT_OF_STOCK') {
    const isSweep =
      payloadOrMetadata?.isSweep === true ||
      payloadOrMetadata?.source === 'SWEEP' ||
      payloadOrMetadata?.metadata?.isSweep === true;
    return isSweep ? 9 : 5;
  }

  const configured = EVENT_PRIORITY_MAP[eventType];
  if (configured !== undefined) {
    return configured;
  }

  // Events with no explicit priority default to 5 at runtime
  return 5;
}
