import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { EcrIssuesController } from './ecr-issues.controller.js';
import { EcrIssuesService } from './ecr-issues.service.js';
import { InternalSecretGuard } from './guards/internal-secret.guard.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { ReceiveEcrPendingDto } from './dto/receive-ecr-pending.dto.js';
import { IssueEcrMaterialDto } from './dto/issue-ecr-material.dto.js';

describe('EcrIssuesController', () => {
  let controller: EcrIssuesController;
  let mockService: any;

  beforeEach(async () => {
    mockService = {
      receivePending: vi.fn().mockResolvedValue({
        id: 'ecr-uuid-1',
        reportNumber: 'REP-2026-001',
        status: 'PENDING',
      }),
      getAll: vi.fn().mockResolvedValue([
        {
          id: 'ecr-uuid-1',
          reportNumber: 'REP-2026-001',
          currentStock: 25,
        },
      ]),
      getOne: vi.fn().mockResolvedValue({
        id: 'ecr-uuid-1',
        reportNumber: 'REP-2026-001',
        product: { id: 'p1', name: 'Flange Body' },
        availableBins: [{ binId: 'b1', binCode: 'B-01', rackCode: 'R-01', currentQty: 25 }],
      }),
      issue: vi.fn().mockResolvedValue({
        success: true,
        stockTransactionId: 'tx-uuid-1',
        issuedAt: new Date('2026-11-02T12:00:00Z'),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EcrIssuesController],
      providers: [
        {
          provide: EcrIssuesService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(InternalSecretGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EcrIssuesController>(EcrIssuesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should delegate to EcrIssuesService.receivePending', async () => {
    const dto: ReceiveEcrPendingDto = {
      ecrId: 'ECR-9901',
      reportNumber: 'REP-2026-001',
      type: 'REWORK',
      scNumber: 'SC-101',
      poNumber: 'PO-501',
      component: 'Flange Body',
      quantityAffected: 3,
      approvedAt: '2026-11-02T10:00:00.000Z',
    };

    const result = await controller.receivePending(dto);
    expect(mockService.receivePending).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      id: 'ecr-uuid-1',
      reportNumber: 'REP-2026-001',
      status: 'PENDING',
    });
  });

  it('should delegate to EcrIssuesService.getAll', async () => {
    const result = await controller.getAll();
    expect(mockService.getAll).toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: 'ecr-uuid-1',
        reportNumber: 'REP-2026-001',
        currentStock: 25,
      },
    ]);
  });

  it('should delegate to EcrIssuesService.getOne with id', async () => {
    const result = await controller.getOne('ecr-uuid-1');
    expect(mockService.getOne).toHaveBeenCalledWith('ecr-uuid-1');
    expect(result).toEqual({
      id: 'ecr-uuid-1',
      reportNumber: 'REP-2026-001',
      product: { id: 'p1', name: 'Flange Body' },
      availableBins: [{ binId: 'b1', binCode: 'B-01', rackCode: 'R-01', currentQty: 25 }],
    });
  });

  it('should delegate to EcrIssuesService.issue with id, dto, and current user', async () => {
    const dto: IssueEcrMaterialDto = {
      productId: 'p-uuid-1',
      binId: 'b-uuid-1',
      quantityIssued: 2,
    };
    const req = {
      user: {
        userId: 'u-uuid-1',
        name: 'Stores Officer',
        email: 'stores@velan.com',
        role: 'STORES',
      },
    };

    const result = await controller.issue('ecr-uuid-1', dto, req);

    expect(mockService.issue).toHaveBeenCalledWith('ecr-uuid-1', dto, {
      id: 'u-uuid-1',
      name: 'Stores Officer',
      email: 'stores@velan.com',
      role: 'STORES',
    });
    expect(result).toEqual({
      success: true,
      stockTransactionId: 'tx-uuid-1',
      issuedAt: new Date('2026-11-02T12:00:00Z'),
    });
  });
});
