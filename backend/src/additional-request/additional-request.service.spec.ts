import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdditionalRequestService } from './additional-request.service.js';
import { AdditionalRequestStatus } from './entities/additional-request.entity.js';
import { ScStatus } from '../sc/entities/sc.entity.js';
import { BadRequestException } from '@nestjs/common';

describe('AdditionalRequestService', () => {
  let service: AdditionalRequestService;
  let requestRepo: any;
  let requestItemRepo: any;
  let scRepo: any;
  let rmItemRepo: any;

  beforeEach(() => {
    requestRepo = {
      create: vi.fn((dto) => ({ id: 'req-1', ...dto })),
      save: vi.fn((r) => Promise.resolve({ id: 'req-1', ...r })),
      findOne: vi.fn(),
    };
    requestItemRepo = {
      create: vi.fn((dto) => ({ id: 'ri-1', ...dto })),
      save: vi.fn((ri) => Promise.resolve(ri)),
    };
    const queryRunnerMock = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        findOne: vi.fn(),
        create: vi.fn((type, dto) => ({ id: 'mocked-id', ...dto })),
        save: vi.fn((type, x) => x),
      },
    };

    scRepo = {
      findOneBy: vi.fn(),
      save: vi.fn((sc) => Promise.resolve(sc)),
      manager: {
        connection: {
          createQueryRunner: vi.fn(() => queryRunnerMock),
        }
      }
    };
    rmItemRepo = {
      findOneBy: vi.fn(),
    };

    service = new AdditionalRequestService(
      requestRepo as any,
      requestItemRepo as any,
      scRepo as any,
      rmItemRepo as any,
    );
  });

  let queryRunnerMockRef: any;

  beforeEach(() => {
    queryRunnerMockRef = (service as any).scRepo.manager.connection.createQueryRunner();
  });

  it('should create an additional material request without deducting stock', async () => {
    queryRunnerMockRef.manager.findOne.mockImplementation(async (entityType) => {
      if (entityType.name === 'SalesOrderComponent') {
        return {
          id: 'sc-1',
          scNumber: 'SC-001',
          status: ScStatus.IN_PRODUCTION,
        };
      }
      if (entityType.name === 'RmItem') {
        return { id: 'rm-1' };
      }
      return null;
    });
    rmItemRepo.findOneBy.mockResolvedValue({ id: 'rm-1' });
    requestRepo.findOne.mockResolvedValue({
      id: 'req-1',
      status: AdditionalRequestStatus.REQUESTED,
    });

    const result = await service.createRequest(
      {
        scId: 'sc-1',
        items: [{ rmItemId: 'rm-1', quantity: 15 }],
      },
      'prod-user-1',
    );

    expect(result).toBeDefined();
    expect(queryRunnerMockRef.manager.save).toHaveBeenCalled();
  });
});
