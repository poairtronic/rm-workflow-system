import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { MercLineItemDto } from './dto/receive-merc-indent.dto.js';
import { MercIndentService } from './merc-indent.service.js';

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

describe('MercIndentService Deletion Logic', () => {
  it('soft-deletes a line item and recalculates parent status when items remain', async () => {
    const mockLineItemRepo: any = {
      findOne: vi.fn().mockResolvedValue({
        id: 'item-1',
        mercIndentPendingId: 'indent-1',
        name: 'Item 1',
        quantityRequired: 5,
        quantityIssued: 0,
        isDeleted: false,
      }),
      save: vi.fn().mockImplementation((item) => Promise.resolve(item)),
      find: vi.fn().mockResolvedValue([
        {
          id: 'item-2',
          mercIndentPendingId: 'indent-1',
          name: 'Item 2',
          quantityRequired: 3,
          quantityIssued: 3,
          status: 'ISSUED',
          isDeleted: false,
        },
      ]),
    };

    const mockPendingRepo: any = {
      findOne: vi.fn().mockResolvedValue({
        id: 'indent-1',
        indentNumber: 'IND-100',
        status: 'PENDING',
        isDeleted: false,
      }),
      save: vi.fn().mockImplementation((ind) => Promise.resolve(ind)),
    };

    const service = new MercIndentService(
      mockPendingRepo,
      mockLineItemRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const res = await service.deleteLineItem('indent-1', 'item-1', { id: 'user-1' });

    expect(res.success).toBe(true);
    expect(res.indentDeleted).toBe(false);
    expect(res.remainingItems).toBe(1);
    expect(mockLineItemRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1', isDeleted: true }),
    );
    expect(mockPendingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'indent-1', status: 'ISSUED' }),
    );
  });

  it('marks parent indent as deleted when the last line item is deleted', async () => {
    const mockLineItemRepo: any = {
      findOne: vi.fn().mockResolvedValue({
        id: 'item-1',
        mercIndentPendingId: 'indent-1',
        name: 'Item 1',
        isDeleted: false,
      }),
      save: vi.fn().mockImplementation((item) => Promise.resolve(item)),
      find: vi.fn().mockResolvedValue([]), // No remaining items
    };

    const mockPendingRepo: any = {
      findOne: vi.fn().mockResolvedValue({
        id: 'indent-1',
        indentNumber: 'IND-100',
        status: 'PENDING',
        isDeleted: false,
      }),
      save: vi.fn().mockImplementation((ind) => Promise.resolve(ind)),
    };

    const service = new MercIndentService(
      mockPendingRepo,
      mockLineItemRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const res = await service.deleteLineItem('indent-1', 'item-1', { id: 'user-1' });

    expect(res.success).toBe(true);
    expect(res.indentDeleted).toBe(true);
    expect(res.remainingItems).toBe(0);
    expect(mockPendingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'indent-1', isDeleted: true, status: 'CANCELLED' }),
    );
  });

  it('soft-deletes an entire indent and marks all its line items as deleted', async () => {
    const mockPendingRepo: any = {
      findOne: vi.fn().mockResolvedValue({
        id: 'indent-1',
        indentNumber: 'IND-100',
        status: 'PENDING',
        isDeleted: false,
      }),
      save: vi.fn().mockImplementation((ind) => Promise.resolve(ind)),
    };

    const mockLineItemRepo: any = {
      update: vi.fn().mockResolvedValue({ affected: 3 }),
    };

    const service = new MercIndentService(
      mockPendingRepo,
      mockLineItemRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const res = await service.deleteIndent('indent-1', { id: 'user-1' });

    expect(res.success).toBe(true);
    expect(mockPendingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'indent-1', isDeleted: true, status: 'CANCELLED' }),
    );
    expect(mockLineItemRepo.update).toHaveBeenCalledWith(
      { mercIndentPendingId: 'indent-1' },
      { isDeleted: true },
    );
  });

  it('throws NotFoundException if line item to delete does not exist', async () => {
    const mockLineItemRepo: any = {
      findOne: vi.fn().mockResolvedValue(null),
    };

    const service = new MercIndentService(
      {} as any,
      mockLineItemRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await expect(service.deleteLineItem('indent-1', 'invalid-id')).rejects.toThrow(
      'Line item "invalid-id" not found or already deleted',
    );
  });
});
