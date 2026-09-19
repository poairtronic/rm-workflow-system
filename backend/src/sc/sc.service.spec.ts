import { Test, TestingModule } from '@nestjs/testing';
import { ScService } from './sc.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SalesOrderComponent, ScStatus } from './entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { ProductionService } from '../production/production.service.js';
import { AdditionalRequestService } from '../additional-request/additional-request.service.js';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

describe('ScService', () => {
  let service: ScService;
  let scRepo: any;
  let poRepo: any;
  let prodServiceMock: any;
  let addlReqServiceMock: any;

  beforeEach(async () => {
    scRepo = {
      findOne: vi.fn(),
      create: vi.fn((x) => x),
      save: vi.fn((x) => x),
      createQueryBuilder: vi.fn(),
      manager: {
        createQueryBuilder: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getCount: vi.fn().mockResolvedValue(0),
        })),
      },
    };
    poRepo = {
      findOne: vi.fn(),
    };
    prodServiceMock = {
      getAccounting: vi.fn().mockResolvedValue({ items: [] }),
    };
    addlReqServiceMock = {
      findAll: vi.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScService,
        {
          provide: getRepositoryToken(SalesOrderComponent),
          useValue: scRepo,
        },
        {
          provide: getRepositoryToken(PurchaseOrder),
          useValue: poRepo,
        },
        {
          provide: ProductionService,
          useValue: prodServiceMock,
        },
        {
          provide: AdditionalRequestService,
          useValue: addlReqServiceMock,
        },
      ],
    }).compile();

    service = module.get<ScService>(ScService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create SC independently under a valid PO', async () => {
    poRepo.findOne.mockResolvedValue({ id: 'po-1', poNumber: 'PO-123' });
    scRepo.findOne.mockResolvedValue(null);

    const sc = await service.createSc({
      poId: 'po-1',
      scNumber: 'SC-123',
      productName: 'Gear Shaft',
    });

    expect(sc.status).toBe(ScStatus.DRAFT);
    expect(sc.poId).toBe('po-1');
    expect(sc.targetQuantity).toBe(1);
  });

  it('should reject duplicate SC creation under the same PO', async () => {
    poRepo.findOne.mockResolvedValue({ id: 'po-1', poNumber: 'PO-123' });
    scRepo.findOne.mockResolvedValue({ scNumber: 'SC-123' });

    await expect(
      service.createSc({
        poId: 'po-1',
        scNumber: 'SC-123',
        productName: 'Gear Shaft',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject SC creation for missing PO', async () => {
    poRepo.findOne.mockResolvedValue(null);

    await expect(
      service.createSc({
        poId: 'missing-po-1',
        scNumber: 'SC-123',
        productName: 'Gear Shaft',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should support independent SC closure (SC001 closes without requiring SC002 to close)', async () => {
    scRepo.findOne.mockResolvedValue({
      id: 'sc-1',
      scNumber: 'SC-123',
      status: ScStatus.COMPLETED,
    });

    const closedSc = await service.closeSc('sc-1', 'user-1', {
      remarks: 'Completed production',
    });
    expect(closedSc.status).toBe(ScStatus.CLOSED);
    expect(closedSc.completionRemarks).toContain(
      'Closed: Completed production',
    );
  });
});
