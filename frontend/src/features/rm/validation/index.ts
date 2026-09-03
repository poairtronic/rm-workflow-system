export interface CreateRMItemInput {
  materialName: string;
  grade: string;
  size: string;
  requiredQty: number;
  unit: string;
  weight?: number;
  diameter?: number;
  length?: number;
  width?: number;
  thickness?: number;
  remarks?: string;
}

export function validateRMItem(input: Partial<CreateRMItemInput>): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};

  if (!input.grade?.trim()) {
    errors.grade = 'Material grade is required (e.g. EN31, OHNS, MS)';
  }

  if (!input.size?.trim()) {
    errors.size = 'Material dimension / size is required (e.g. Ø110×35)';
  }

  if (!input.requiredQty || input.requiredQty <= 0) {
    errors.requiredQty = 'Required quantity must be greater than zero';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
