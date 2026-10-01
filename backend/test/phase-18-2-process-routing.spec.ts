import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { ProductionProcess } from '../src/production-process/entities/production-process.entity.js';
import {
  ProcessRoutingService,
  ProcessTransitionValidationResult,
} from '../src/production-process/process-routing.service.js';

describe('Phase 18.2 — Process Sequence Rules & Routing Engine Test Suite', () => {
  let service: ProcessRoutingService;
  let repo: Partial<Record<keyof Repository<ProductionProcess>, any>>;

  // Mock Shop-Floor Routing:
  // Step 1: Laser Cutting (Seq 1, Unskippable, Non-repeatable, Internal only)
  // Step 2: CNC Machining (Seq 2, Unskippable, Repeatable, Internal only)
  // Step 3: Deburring / Polishing (Seq 3, Skippable, Non-repeatable, Internal only)
  // Step 4: Heat Treatment (Seq 4, Unskippable, Non-repeatable, Outside Vendor Allowed)
  // Step 5: Final Quality Inspection (Seq 5, Unskippable, Non-repeatable, Internal only)
  const process1: ProductionProcess = {
    id: 'proc-uuid-1',
    code: 'CUT-01',
    name: 'Laser Cutting',
    sequenceNumber: 1,
    category: 'CUTTING',
    isActive: true,
    isSkippable: false,
    isRepeatable: false,
    allowsOutsideVendor: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const process2: ProductionProcess = {
    id: 'proc-uuid-2',
    code: 'CNC-01',
    name: 'CNC Machining',
    sequenceNumber: 2,
    category: 'MACHINING',
    isActive: true,
    isSkippable: false,
    isRepeatable: true, // REPEATABLE
    allowsOutsideVendor: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const process3: ProductionProcess = {
    id: 'proc-uuid-3',
    code: 'POL-01',
    name: 'Deburring & Polishing',
    sequenceNumber: 3,
    category: 'FINISHING',
    isActive: true,
    isSkippable: true, // SKIPPABLE
    isRepeatable: false,
    allowsOutsideVendor: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const process4: ProductionProcess = {
    id: 'proc-uuid-4',
    code: 'HT-01',
    name: 'Heat Treatment',
    sequenceNumber: 4,
    category: 'SPECIAL_PROCESS',
    isActive: true,
    isSkippable: false,
    isRepeatable: false,
    allowsOutsideVendor: true, // VENDOR JOB-WORK
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const process5: ProductionProcess = {
    id: 'proc-uuid-5',
    code: 'QC-01',
    name: 'Final Quality Inspection',
    sequenceNumber: 5,
    category: 'INSPECTION',
    isActive: true,
    isSkippable: false,
    isRepeatable: false,
    allowsOutsideVendor: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const allProcesses = [process1, process2, process3, process4, process5];

  beforeEach(() => {
    repo = {
      find: vi.fn(),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    service = new ProcessRoutingService(repo as any);
  });

  // =========================================================================
  // 1. SEQUENCE NAVIGATION (First, Final, Next, Previous)
  // =========================================================================
  describe('1. Process Sequence Navigation', () => {
    it('ROUTE-NAV-001: getFirstProcess() returns process with lowest sequence number', async () => {
      repo.findOne.mockResolvedValue(process1);

      const first = await service.getFirstProcess();
      expect(first).toBe(process1);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sequenceNumber: 'ASC' },
      });
    });

    it('ROUTE-NAV-002: getFinalProcess() returns process with highest sequence number', async () => {
      repo.findOne.mockResolvedValue(process5);

      const final = await service.getFinalProcess();
      expect(final).toBe(process5);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sequenceNumber: 'DESC' },
      });
    });

    it('ROUTE-NAV-003: getNextProcess() finds subsequent active process', async () => {
      // Find current process
      repo.findOne.mockResolvedValueOnce(process1);
      // Find next process
      repo.findOne.mockResolvedValueOnce(process2);

      const next = await service.getNextProcess('proc-uuid-1');
      expect(next).toBe(process2);
    });

    it('ROUTE-NAV-004: getNextProcess() returns null if currently at final process', async () => {
      repo.findOne.mockResolvedValueOnce(process5);
      repo.findOne.mockResolvedValueOnce(null);

      const next = await service.getNextProcess('proc-uuid-5');
      expect(next).toBeNull();
    });

    it('ROUTE-NAV-005: getPreviousProcess() finds preceding active process', async () => {
      repo.findOne.mockResolvedValueOnce(process2);
      repo.findOne.mockResolvedValueOnce(process1);

      const prev = await service.getPreviousProcess('proc-uuid-2');
      expect(prev).toBe(process1);
    });

    it('ROUTE-NAV-006: getPreviousProcess() returns null if currently at first process', async () => {
      repo.findOne.mockResolvedValueOnce(process1);
      repo.findOne.mockResolvedValueOnce(null);

      const prev = await service.getPreviousProcess('proc-uuid-1');
      expect(prev).toBeNull();
    });

    it('ROUTE-NAV-007: getNavigation() returns complete navigation object with boundary flags', async () => {
      // current process
      repo.findOne.mockImplementation(async ({ where, order }: any) => {
        if (where?.id === 'proc-uuid-1') return process1;
        if (order?.sequenceNumber === 'ASC') return process1; // first
        if (order?.sequenceNumber === 'DESC') return process5; // final
        return null;
      });

      const nav = await service.getNavigation('proc-uuid-1');
      expect(nav.current.id).toBe('proc-uuid-1');
      expect(nav.isFirst).toBe(true);
      expect(nav.isFinal).toBe(false);
      expect(nav.isSkippable).toBe(false);
      expect(nav.isRepeatable).toBe(false);
    });
  });

  // =========================================================================
  // 2. PROCESS TRANSITION & ROUTING RULES
  // =========================================================================
  describe('2. Process Transition & Validation Rules', () => {
    it('ROUTE-RULE-001: DIRECT_NEXT — Moving to adjacent successor step is valid', async () => {
      // findProcessOrThrow for both
      repo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'proc-uuid-1') return process1;
        if (where?.id === 'proc-uuid-2') return process2;
        return null;
      });

      // Mock queryBuilder returning 0 intermediate processes
      const qb: any = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result: ProcessTransitionValidationResult =
        await service.validateTransition('proc-uuid-1', 'proc-uuid-2');

      expect(result.isValid).toBe(true);
      expect(result.transitionType).toBe('DIRECT_NEXT');
    });

    it('ROUTE-RULE-002: REPEAT — Repeat on repeatable process (CNC-01) is allowed', async () => {
      repo.findOne.mockResolvedValue(process2); // isRepeatable = true

      const result = await service.validateTransition('proc-uuid-2', 'proc-uuid-2');

      expect(result.isValid).toBe(true);
      expect(result.transitionType).toBe('REPEAT');
    });

    it('ROUTE-RULE-003: REPEAT — Repeat on non-repeatable process (CUT-01) is rejected', async () => {
      repo.findOne.mockResolvedValue(process1); // isRepeatable = false

      const result = await service.validateTransition('proc-uuid-1', 'proc-uuid-1');

      expect(result.isValid).toBe(false);
      expect(result.transitionType).toBe('INVALID');
      expect(result.reason).toContain('is not repeatable');
    });

    it('ROUTE-RULE-004: SKIP — Skipping an optional/skippable step (POL-01) is allowed', async () => {
      // Transition from step 2 (CNC-01) to step 4 (HT-01), skipping step 3 (POL-01, isSkippable: true)
      repo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'proc-uuid-2') return process2;
        if (where?.id === 'proc-uuid-4') return process4;
        return null;
      });

      const qb: any = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([process3]), // intermediate process is skippable
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validateTransition('proc-uuid-2', 'proc-uuid-4');

      expect(result.isValid).toBe(true);
      expect(result.transitionType).toBe('SKIP');
      expect(result.skippedProcesses).toEqual([process3]);
    });

    it('ROUTE-RULE-005: SKIP — Skipping an unskippable step is rejected', async () => {
      // Transition from step 1 (CUT-01) to step 3 (POL-01), attempting to skip step 2 (CNC-01, isSkippable: false)
      repo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'proc-uuid-1') return process1;
        if (where?.id === 'proc-uuid-3') return process3;
        return null;
      });

      const qb: any = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([process2]), // CNC-01 is unskippable
      };
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.validateTransition('proc-uuid-1', 'proc-uuid-3');

      expect(result.isValid).toBe(false);
      expect(result.transitionType).toBe('INVALID');
      expect(result.reason).toContain('Cannot skip mandatory');
      expect(result.reason).toContain('CNC Machining');
    });

    it('ROUTE-RULE-006: BACKWARD — Backward transition is prohibited without rework authorization', async () => {
      // Transition from step 4 (HT-01) back to step 2 (CNC-01)
      repo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'proc-uuid-4') return process4;
        if (where?.id === 'proc-uuid-2') return process2;
        return null;
      });

      const result = await service.validateTransition('proc-uuid-4', 'proc-uuid-2');

      expect(result.isValid).toBe(false);
      expect(result.transitionType).toBe('BACKWARD_REWORK');
      expect(result.reason).toContain('prohibited without an authorized rework');
    });

    it('ROUTE-RULE-007: INACTIVE — Transition involving inactive process is rejected', async () => {
      const inactiveProcess = { ...process1, isActive: false };
      repo.findOne.mockImplementation(async ({ where }: any) => {
        if (where?.id === 'proc-uuid-1') return inactiveProcess;
        if (where?.id === 'proc-uuid-2') return process2;
        return null;
      });

      const result = await service.validateTransition('proc-uuid-1', 'proc-uuid-2');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('is inactive');
    });
  });

  // =========================================================================
  // 3. OUTSIDE VENDOR PROCESSING ELIGIBILITY (DC Foundation)
  // =========================================================================
  describe('3. Outside Vendor Eligibility (DC Foundation)', () => {
    it('ROUTE-VND-001: getEligibleVendorProcesses() returns only processes with allowsOutsideVendor = true', async () => {
      repo.find.mockResolvedValue([process4]); // only Heat Treatment allows outside vendor

      const result = await service.getEligibleVendorProcesses();

      expect(result.length).toBe(1);
      expect(result[0].code).toBe('HT-01');
      expect(result[0].allowsOutsideVendor).toBe(true);
      expect(repo.find).toHaveBeenCalledWith({
        where: {
          isActive: true,
          allowsOutsideVendor: true,
        },
        order: { sequenceNumber: 'ASC' },
      });
    });
  });
});
