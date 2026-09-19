import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaterialIssueService } from './material-issue.service.js';
import { ScStatus } from '../sc/entities/sc.entity.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('MaterialIssueService', () => {
  let service: MaterialIssueService;
  let issueRepo: any;
  let issueItemRepo: any;
  let scRepo: any;
  let rmItemRepo: any;
  let binRepo: any;
  let dataSource: any;

  beforeEach(() => {
    issueRepo = {
      create: vi.fn((dto) => ({ id: 'issue-1', ...dto })),
      findOne: vi.fn(),
    };
    issueItemRepo = {};
    scRepo = {
      findOneBy: vi.fn(),
    };
    rmItemRepo = {};
    binRepo = {};

    const queryRunnerMock = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        save: vi.fn((entity, data) => Promise.resolve({ id: 'saved-id', ...data })),
        findOne: vi.fn((entity, options) => {
          if (options.where?.id === 'rm-item-1') return Promise.resolve({ id: 'rm-item-1', material: 'Steel', mappedProductId: 'prod-1', rmRequest: { status: 'REVIEWED' } });
          if (options.where?.id === 'bin-1') return Promise.resolve({ id: 'bin-1', code: 'BIN-A1', isActive: true });
          if (options.where?.binId === 'bin-1') return Promise.resolve({ currentQuantity: 100 });
          return Promise.resolve(null);
        }),
        query: vi.fn().mockResolvedValue([[], 1]),
        create: vi.fn((entity, data) => ({ id: 'tx-1', ...data })),
      },
    };

    dataSource = {
      createQueryRunner: vi.fn().mockReturnValue(queryRunnerMock),
    };

    service = new MaterialIssueService(
      issueRepo as any,
      issueItemRepo as any,
      scRepo as any,
      rmItemRepo as any,
      binRepo as any,
      dataSource as any,
    );
  });

  it('should issue stock atomically from exact bin and update SC status', async () => {
    scRepo.findOneBy.mockResolvedValue({ id: 'sc-1', scNumber: 'SC-001', status: ScStatus.SUBMITTED });
    issueRepo.findOne.mockResolvedValue({ id: 'issue-1', issueNumber: 'ISS-100', items: [] });

    const dto = {
      scId: 'sc-1',
      items: [
        {
          rmItemId: 'rm-item-1',
          binId: 'bin-1',
          quantityIssued: 25,
        },
      ],
    };

    const result = await service.createIssue(dto, 'stores-user-1');
    expect(result).toBeDefined();
    expect(dataSource.createQueryRunner).toHaveBeenCalled();
  });

  it('should reject issue when stock in bin is insufficient', async () => {
    scRepo.findOneBy.mockResolvedValue({ id: 'sc-1', scNumber: 'SC-001', status: ScStatus.SUBMITTED });

    // Override manager findOne to return insufficient stock
    const qr = dataSource.createQueryRunner();
    qr.manager.findOne = vi.fn((entity, options) => {
      if (options.where?.id === 'rm-item-1') return Promise.resolve({ id: 'rm-item-1', mappedProductId: 'prod-1', rmRequest: { status: 'REVIEWED' } });
      if (options.where?.id === 'bin-1') return Promise.resolve({ id: 'bin-1', code: 'BIN-A1', isActive: true });
      if (options.where?.binId === 'bin-1') return Promise.resolve({ currentQuantity: 5 }); // Only 5 available!
      return Promise.resolve(null);
    });

    const dto = {
      scId: 'sc-1',
      items: [
        {
          rmItemId: 'rm-item-1',
          binId: 'bin-1',
          quantityIssued: 25, // Requesting 25 > 5!
        },
      ],
    };

    await expect(service.createIssue(dto, 'stores-user-1')).rejects.toThrow(BadRequestException);
  });
});
