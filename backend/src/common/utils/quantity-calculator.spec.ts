import { describe, it, expect } from 'vitest';
import { QuantityCalculator } from './quantity-calculator.js';
import { BadRequestException } from '@nestjs/common';

describe('QuantityCalculator', () => {
  it('should round decimal numbers safely to 3 decimal places', () => {
    expect(QuantityCalculator.roundDecimal(10.12567)).toBe(10.126);
    expect(QuantityCalculator.roundDecimal(10.125)).toBe(10.125);
    expect(QuantityCalculator.roundDecimal(0.0001)).toBe(0);
    expect(QuantityCalculator.roundDecimal(0.001)).toBe(0.001);
  });

  it('should calculate unaccounted material correctly: RECEIVED - CONSUMED - RETURNED', () => {
    expect(QuantityCalculator.calculateUnaccounted(100, 70, 30)).toBe(0);
    expect(QuantityCalculator.calculateUnaccounted(100, 60, 20)).toBe(20);
    expect(QuantityCalculator.calculateUnaccounted(50, 60, 0)).toBe(0); // Never negative
  });

  it('should assert positive quantities for movements', () => {
    expect(() => QuantityCalculator.assertPositive(10, 'Qty')).not.toThrow();
    expect(() => QuantityCalculator.assertPositive(0, 'Qty')).toThrow(
      BadRequestException,
    );
    expect(() => QuantityCalculator.assertPositive(-5, 'Qty')).toThrow(
      BadRequestException,
    );
  });

  it('should assert non-negative quantities', () => {
    expect(() => QuantityCalculator.assertNonNegative(0, 'Qty')).not.toThrow();
    expect(() => QuantityCalculator.assertNonNegative(15, 'Qty')).not.toThrow();
    expect(() => QuantityCalculator.assertNonNegative(-0.01, 'Qty')).toThrow(
      BadRequestException,
    );
  });

  it('should reject requested quantity exceeding available limit', () => {
    expect(() =>
      QuantityCalculator.assertWithinLimit(50, 100, 'Exceeded'),
    ).not.toThrow();
    expect(() =>
      QuantityCalculator.assertWithinLimit(100.001, 100, 'Exceeded'),
    ).toThrow(BadRequestException);
  });
});
