import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  buildProductKey,
  buildType1LockKey,
  buildType3LockKey,
} from './product-key.util.js';

describe('product-key.util', () => {
  describe('normalizeText', () => {
    it('handles null and undefined', () => {
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeText('  test  ')).toBe('TEST');
    });

    it('collapses multiple spaces, tabs, and newlines into a single space', () => {
      expect(normalizeText('  ARG   DIA \t 14.229 \n +/-  0.02  ')).toBe('ARG DIA 14.229 +/- 0.02');
    });

    it('converts lowercase characters to uppercase', () => {
      expect(normalizeText('base plate m6 pin')).toBe('BASE PLATE M6 PIN');
    });
  });

  describe('buildProductKey', () => {
    it('accepts a raw string', () => {
      expect(buildProductKey('  flange  ring \t 100mm ')).toBe('FLANGE RING 100MM');
    });

    it('prioritizes productId when provided', () => {
      const result = buildProductKey({
        productId: '  c1450428-bd5d-40d8-916b-371358e788aa  ',
        partName: 'Some Part Name',
      });
      expect(result).toBe('C1450428-BD5D-40D8-916B-371358E788AA');
    });

    it('falls back to partName when productId is absent or empty', () => {
      expect(buildProductKey({ productId: '', partName: '  m6   hex bolt  ' })).toBe('M6 HEX BOLT');
      expect(buildProductKey({ productId: null, partName: '  bearing  cover  ' })).toBe('BEARING COVER');
      expect(buildProductKey({ partName: '  housing   bracket  ' })).toBe('HOUSING BRACKET');
    });

    it('returns empty string when both are missing', () => {
      expect(buildProductKey({ productId: null, partName: null })).toBe('');
      expect(buildProductKey({ productId: '', partName: '   ' })).toBe('');
    });
  });

  describe('buildType1LockKey', () => {
    it('formats key with scId and productKey', () => {
      const key = buildType1LockKey('sc-1234', 'APG DIA 26.50 +0.03');
      expect(key).toBe('TYPE1|sc-1234|APG DIA 26.50 +0.03');
    });
  });

  describe('buildType3LockKey', () => {
    it('formats key with normalized poNumber and mercItemId', () => {
      const key = buildType3LockKey('  PO   980  ', 'merc-item-99');
      expect(key).toBe('SPL|PO 980|merc-item-99');
    });
  });
});

