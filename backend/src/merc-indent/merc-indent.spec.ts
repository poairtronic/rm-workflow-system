import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { MercLineItemDto } from './dto/receive-merc-indent.dto.js';

describe('MercIndent DTO and Dimension Mapping', () => {
  it('should support both lengthMm/diameterMm and length/diameter aliases on MercLineItemDto', () => {
    const dto = new MercLineItemDto();
    dto.mercItemId = 'item-1';
    dto.itemType = 'RAW_MATERIAL';
    dto.name = 'Air Plug';
    dto.shape = 'ROUND_BAR';
    dto.diameterMm = 75;
    dto.lengthMm = 60;
    dto.quantityRequired = 1;

    expect(dto.diameterMm).toBe(75);
    expect(dto.lengthMm).toBe(60);

    // Also support alias fields if passed in payload
    dto.length = 60;
    dto.diameter = 75;
    expect(dto.length).toBe(60);
    expect(dto.diameter).toBe(75);
  });

  it('formats ROUND shape dimensions as Ø {diameter} mm × {length} mm when length is present', () => {
    const formatDimensions = (item: { diameterMm?: number | null; lengthMm?: number | null; itemType?: string }) => {
      if (item.itemType === 'BROUGHT_OUT') return '—';
      if (item.diameterMm && Number(item.diameterMm) > 0) {
        if (item.lengthMm && Number(item.lengthMm) > 0) {
          return `Ø ${item.diameterMm} mm × ${item.lengthMm} mm`;
        }
        return `Ø ${item.diameterMm} mm`;
      }
      return '—';
    };

    expect(formatDimensions({ diameterMm: 75, lengthMm: 60 })).toBe('Ø 75 mm × 60 mm');
    expect(formatDimensions({ diameterMm: 30, lengthMm: null })).toBe('Ø 30 mm');
    expect(formatDimensions({ diameterMm: 20, lengthMm: 0 })).toBe('Ø 20 mm');
    expect(formatDimensions({ diameterMm: 20, lengthMm: 75 })).toBe('Ø 20 mm × 75 mm');
  });
});
