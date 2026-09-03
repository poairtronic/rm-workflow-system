/**
 * Production shop floor material balancing and conservation calculator
 */

export interface MaterialBalanceCheck {
  isValid: boolean;
  unaccountedQuantity: number;
  consumed: number;
  returned: number;
  received: number;
  errorMessage?: string;
}

export class MaterialMathUtil {
  /**
   * Validates conservation invariant: Consumed + Returned <= Received.
   * Throws or returns validation result when impossible quantities are supplied.
   */
  static validateConservation(
    received: number,
    consumed: number,
    returned: number,
  ): MaterialBalanceCheck {
    const accounted = consumed + returned;
    const unaccounted = Number((received - accounted).toFixed(3));

    if (accounted > received) {
      return {
        isValid: false,
        unaccountedQuantity: unaccounted,
        consumed,
        returned,
        received,
        errorMessage: `Material conservation error: Consumed (${consumed}) + Returned (${returned}) = ${accounted}, which exceeds Received (${received}). Excess: ${Number((accounted - received).toFixed(3))}`,
      };
    }

    return {
      isValid: true,
      unaccountedQuantity: Math.max(0, unaccounted),
      consumed,
      returned,
      received,
    };
  }

  /**
   * Calculates unaccounted / remaining floor quantity:
   * Unaccounted = Received - Consumed - Returned
   */
  static calculateUnaccounted(
    received: number,
    consumed: number,
    returned: number,
  ): number {
    return Number((received - (consumed + returned)).toFixed(3));
  }

  /**
   * Derives consumed quantity from return:
   * Consumed = Received - Returned
   */
  static deriveConsumedFromReturn(received: number, returned: number): number {
    if (returned > received) {
      throw new Error(
        `Returned quantity (${returned}) cannot exceed received quantity (${received})`,
      );
    }
    return Number((received - returned).toFixed(3));
  }

  /**
   * Calculates pending quantity yet to be issued by Stores:
   * Pending = Requested - Issued
   */
  static calculatePendingIssue(requested: number, issued: number): number {
    return Math.max(0, Number((requested - issued).toFixed(3)));
  }
}
