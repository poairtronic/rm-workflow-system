/**
 * Standard formatters for manufacturing domain strings and numbers
 */

export function formatMaterialSize(grade: string, size: string): string {
  return `${grade} · ${size}`;
}

export function formatQuantity(qty: number, unit: string = 'Nos'): string {
  return `${qty.toLocaleString()} ${unit}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
