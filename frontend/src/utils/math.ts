/**
 * Material balance calculation helper functions (client-side display validation)
 */

export function calculateMaterialBalance(issued: number, consumed: number, returned: number): number {
  return Math.max(0, issued - (consumed + returned));
}

export function calculateShortage(required: number, issued: number): number {
  return Math.max(0, required - issued);
}
