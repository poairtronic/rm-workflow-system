import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RmService } from './rm.service.js';
import { RmRequestStatus, FormType } from './entities/rm-request.entity.js';
import { ScStatus } from '../sc/entities/sc.entity.js';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('RmService', () => {
  let service: RmService;
  let rmRepo: any;
  let rmItemRepo: any;
  let scRepo: any;

  beforeEach(() => {
    rmRepo = {
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      create: vi.fn((dto) => ({ id: 'rm-1', ...dto })),
      save: vi.fn((rm) => Promise.resolve({ id: 'rm-1', ...rm })),
    };
    rmItemRepo = {
      create: vi.fn((dto) => ({ id: 'item-1', ...dto })),
      save: vi.fn((item) => Promise.resolve({ id: 'item-1', ...item })),
    };
    scRepo = {
      findOneBy: vi.fn(),
      save: vi.fn((sc) => Promise.resolve(sc)),
    };

    service = new RmService(rmRepo as any, rmItemRepo as any, scRepo as any);
  });

  it('should create RM without reducing stock', async () => {
    scRepo.findOneBy.mockResolvedValue({ id: 'sc-1', scNumber: 'SC-001' });
    rmRepo.findOneBy.mockResolvedValue(null);

    const rm = await service.createRm({ scId: 'sc-1', remarks: 'New RM Request' }, 'designer-1');

    expect(rm).toBeDefined();
    expect(rm.status).toBe(RmRequestStatus.DRAFT);
  });

  it('should submit RM and update SC status without changing stock', async () => {
    const rm = {
      id: 'rm-1',
      status: RmRequestStatus.DRAFT,
      items: [{ id: 'item-1', material: 'Steel 316L', quantity: 50 }],
      salesOrderComponent: { id: 'sc-1', status: ScStatus.DRAFT },
    };
    rmRepo.findOne.mockResolvedValue(rm);

    const submittedRm = await service.submitRm('rm-1', { remarks: 'Submitted for stores verification' });

    expect(submittedRm.status).toBe(RmRequestStatus.SUBMITTED);
    expect(rm.salesOrderComponent.status).toBe(ScStatus.SUBMITTED);
  });

  it('should reject submitting RM without items', async () => {
    const rm = {
      id: 'rm-1',
      status: RmRequestStatus.DRAFT,
      items: [],
    };
    rmRepo.findOne.mockResolvedValue(rm);

    await expect(service.submitRm('rm-1')).rejects.toThrow(BadRequestException);
  });
});
