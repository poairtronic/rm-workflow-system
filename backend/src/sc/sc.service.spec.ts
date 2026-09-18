import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScService } from './sc.service.js';
import { ScStatus } from './entities/sc.entity.js';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('ScService', () => {
  let service: ScService;
  let scRepo: any;
  let poRepo: any;
  let customerRepo: any;

  beforeEach(() => {
    scRepo = {
      findOne: vi.fn(),
      create: vi.fn((dto) => ({ id: 'sc-1', ...dto })),
      save: vi.fn((sc) => Promise.resolve({ id: 'sc-1', ...sc })),
      createQueryBuilder: vi.fn(),
    };
    poRepo = {
      findOne: vi.fn(),
      create: vi.fn((dto) => ({ id: 'po-1', ...dto })),
      save: vi.fn((po) => Promise.resolve({ id: 'po-1', ...po })),
    };
    customerRepo = {
      findOne: vi.fn(),
      create: vi.fn((dto) => ({ id: 'cust-1', ...dto })),
      save: vi.fn((c) => Promise.resolve({ id: 'cust-1', ...c })),
    };

    service = new ScService(scRepo as any, poRepo as any, customerRepo as any);
  });

  it('should create an SC with external PO reference', async () => {
    scRepo.findOne.mockResolvedValue(null);
    poRepo.findOne.mockResolvedValue({ id: 'po-1', poNumber: 'PO-001' });

    const sc = await service.createSc({
      poNumber: 'PO-001',
      scNumber: 'SC-001',
      productName: 'Gear Shaft',
      targetQuantity: 10,
    });

    expect(sc).toBeDefined();
    expect(sc.scNumber).toBe('SC-001');
    expect(sc.status).toBe(ScStatus.DRAFT);
  });

  it('should reject duplicate SC creation', async () => {
    scRepo.findOne.mockResolvedValue({ id: 'existing-sc', scNumber: 'SC-001' });

    await expect(
      service.createSc({
        poNumber: 'PO-001',
        scNumber: 'SC-001',
        productName: 'Gear Shaft',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should support independent SC closure (SC001 closes without requiring SC002 to close)', async () => {
    const sc = {
      id: 'sc-1',
      scNumber: 'SC-001',
      status: ScStatus.IN_PRODUCTION,
      completionRemarks: '',
    };
    scRepo.findOne.mockResolvedValue(sc);

    const closedSc = await service.closeSc('sc-1', 'user-1', { remarks: 'Completed production batch' });
    expect(closedSc.status).toBe(ScStatus.COMPLETED);
    expect(closedSc.completionRemarks).toContain('Closed: Completed production batch');
  });
});
