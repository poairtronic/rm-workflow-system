import { BadRequestException } from '@nestjs/common';

export class QuantityCalculator {
  /**
   * Safely rounds a number to 3 decimal places to prevent floating-point inaccuracies.
   */
  static roundDecimal(value: number): number {
    if (isNaN(value) || value === null || value === undefined) return 0;
    return Math.round(Number(value) * 1000) / 1000;
  }

  /**
   * Calculates unaccounted quantity: RECEIVED - CONSUMED - ACKNOWLEDGED RETURNED
   * This represents the liability that must be resolved before SC completion.
   */
  static calculateUnaccounted(
    received: number,
    consumed: number,
    returned: number,
  ): number {
    const rec = this.roundDecimal(received);
    const con = this.roundDecimal(consumed);
    const ret = this.roundDecimal(returned);
    const raw = rec - con - ret;
    return Math.max(0, this.roundDecimal(raw));
  }

  /**
   * Calculates available WIP quantity: RECEIVED - CONSUMED - (ALL VALID RETURNS)
   * This represents physically available inventory on the shop floor for consumption or return.
   */
  static calculateWip(
    received: number,
    consumed: number,
    validReturned: number,
  ): number {
    const rec = this.roundDecimal(received);
    const con = this.roundDecimal(consumed);
    const ret = this.roundDecimal(validReturned);
    const raw = rec - con - ret;
    return Math.max(0, this.roundDecimal(raw));
  }

  /**
   * Validates that quantity is greater than zero for movement operations.
   */
  static assertPositive(quantity: number, fieldName = 'Quantity'): void {
    const qty = this.roundDecimal(quantity);
    if (qty <= 0) {
      throw new BadRequestException(
        `${fieldName} must be greater than zero. Received: ${quantity}`,
      );
    }
  }

  /**
   * Validates that cumulative or target quantity is non-negative.
   */
  static assertNonNegative(quantity: number, fieldName = 'Quantity'): void {
    const qty = this.roundDecimal(quantity);
    if (qty < 0) {
      throw new BadRequestException(
        `${fieldName} cannot be negative. Received: ${quantity}`,
      );
    }
  }

  /**
   * Validates that requested quantity does not exceed available limit.
   */
  static assertWithinLimit(
    requested: number,
    limit: number,
    errorMessage: string,
  ): void {
    const req = this.roundDecimal(requested);
    const lim = this.roundDecimal(limit);
    if (req > lim + 0.0005) {
      throw new BadRequestException(
        `${errorMessage} Requested: ${req}, Available Limit: ${lim}`,
      );
    }
  }
}
