/**
 * Utility for normalizing text and constructing lock keys for Delivery Challan product-level locking.
 */

/**
 * Normalizes a string by trimming, collapsing consecutive whitespace to a single space,
 * and converting to uppercase.
 */
export function normalizeText(value?: string | null): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/**
 * Builds a normalized product key from a productId or partName.
 * Trims, collapses whitespace, and converts to uppercase.
 * Accepts either an object { productId, partName } or a raw string.
 */
export function buildProductKey(
  input: string | { productId?: string | null; partName?: string | null }
): string {
  if (typeof input === 'string') {
    return normalizeText(input);
  }

  if (input && typeof input === 'object') {
    if (input.productId && String(input.productId).trim()) {
      return normalizeText(input.productId);
    }
    if (input.partName && String(input.partName).trim()) {
      return normalizeText(input.partName);
    }
  }

  return '';
}

/**
 * Constructs the lock key for Type 1 (PRODUCTION_PROCESS_OUTWARD).
 * Scope: sc_id + product_key
 */
export function buildType1LockKey(scId: string, productKey: string): string {
  return `TYPE1|${String(scId).trim()}|${normalizeText(productKey)}`;
}

/**
 * Constructs the lock key for Type 3 (SPL_PROCESS).
 * Scope: normalized po_number + merc_item_id
 */
export function buildType3LockKey(poNumber: string, mercItemId: string): string {
  return `SPL|${normalizeText(poNumber)}|${String(mercItemId).trim()}`;
}

