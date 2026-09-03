/**
 * Material balance and conservation calculation helpers
 */

export interface MaterialConservationResult {
  isValid: boolean;
  unaccountedQuantity: number;
  errorMessage?: string;
}

/**
 * Validates that Consumed + Returned <= Received.
 * Prevents impossible material accounting states.
 */
export function validateMaterialConservation(
  received: number,
  consumed: number,
  returned: number
): MaterialConservationResult {
  const accounted = consumed + returned;
  const unaccounted = received - accounted;

  if (accounted > received) {
    return {
      isValid: false,
      unaccountedQuantity: unaccounted,
      errorMessage: `Inconsistent material quantities: Consumed (${consumed}) + Returned (${returned}) exceeds Total Received (${received}). Excess: ${accounted - received}`,
    };
  }

  return {
    isValid: true,
    unaccountedQuantity: Math.max(0, unaccounted),
  };
}

/**
 * Calculates remaining unaccounted material on the shop floor:
 * Unaccounted = Received - Consumed - Returned
 */
export function calculateUnaccountedQuantity(
  received: number,
  consumed: number,
  returned: number
): number {
  return received - (consumed + returned);
}

/**
 * Auto-derives consumed quantity when return is recorded at batch completion:
 * Consumed = Received - Returned
 */
export function deriveConsumedFromReturn(received: number, returned: number): number {
  if (returned > received) {
    throw new Error(
      `Returned quantity (${returned}) cannot exceed received quantity (${received})`
    );
  }
  return received - returned;
}

/**
 * Calculates pending material still to be issued by Stores:
 * Pending = Requested - Issued
 */
export function calculatePendingIssue(requested: number, issued: number): number {
  return Math.max(0, requested - issued);
}
