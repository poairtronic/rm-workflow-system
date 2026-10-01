import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan } from 'typeorm';
import { ProductionProcess } from './entities/production-process.entity.js';

export interface ProcessNavigationInfo {
  current: ProductionProcess;
  previous: ProductionProcess | null;
  next: ProductionProcess | null;
  first: ProductionProcess | null;
  final: ProductionProcess | null;
  isFirst: boolean;
  isFinal: boolean;
  isSkippable: boolean;
  isRepeatable: boolean;
  allowsOutsideVendor: boolean;
}

export type ProcessTransitionType =
  | 'DIRECT_NEXT'
  | 'REPEAT'
  | 'SKIP'
  | 'BACKWARD_REWORK'
  | 'INVALID';

export interface ProcessTransitionValidationResult {
  isValid: boolean;
  fromProcess: ProductionProcess;
  toProcess: ProductionProcess;
  transitionType: ProcessTransitionType;
  skippedProcesses?: ProductionProcess[];
  reason?: string;
}

@Injectable()
export class ProcessRoutingService {
  private readonly logger = new Logger(ProcessRoutingService.name);

  constructor(
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
  ) {}

  /**
   * Identifies the initial manufacturing step (lowest active sequence number).
   */
  async getFirstProcess(): Promise<ProductionProcess | null> {
    return this.processRepo.findOne({
      where: { isActive: true },
      order: { sequenceNumber: 'ASC' },
    });
  }

  /**
   * Identifies the terminal step (highest active sequence number).
   */
  async getFinalProcess(): Promise<ProductionProcess | null> {
    return this.processRepo.findOne({
      where: { isActive: true },
      order: { sequenceNumber: 'DESC' },
    });
  }

  /**
   * Retrieves the chronological successor step (active process with next highest sequence).
   */
  async getNextProcess(currentProcessId: string): Promise<ProductionProcess | null> {
    const current = await this.findProcessOrThrow(currentProcessId);
    return this.processRepo.findOne({
      where: {
        isActive: true,
        sequenceNumber: MoreThan(current.sequenceNumber),
      },
      order: { sequenceNumber: 'ASC' },
    });
  }

  /**
   * Retrieves the chronological predecessor step (active process with nearest lower sequence).
   */
  async getPreviousProcess(currentProcessId: string): Promise<ProductionProcess | null> {
    const current = await this.findProcessOrThrow(currentProcessId);
    return this.processRepo.findOne({
      where: {
        isActive: true,
        sequenceNumber: LessThan(current.sequenceNumber),
      },
      order: { sequenceNumber: 'DESC' },
    });
  }

  /**
   * Returns complete navigational context for a given process stage.
   */
  async getNavigation(currentProcessId: string): Promise<ProcessNavigationInfo> {
    const current = await this.findProcessOrThrow(currentProcessId);
    const [previous, next, first, final] = await Promise.all([
      this.getPreviousProcess(currentProcessId),
      this.getNextProcess(currentProcessId),
      this.getFirstProcess(),
      this.getFinalProcess(),
    ]);

    const isFirst = first?.id === current.id;
    const isFinal = final?.id === current.id;

    return {
      current,
      previous,
      next,
      first,
      final,
      isFirst,
      isFinal,
      isSkippable: current.isSkippable,
      isRepeatable: current.isRepeatable,
      allowsOutsideVendor: current.allowsOutsideVendor,
    };
  }

  /**
   * Validates whether a component/work-order can transition from fromProcess to toProcess.
   * Enforces rules on direct progression, repetition (loops), skips, and backward transitions.
   */
  async validateTransition(
    fromProcessId: string,
    toProcessId: string,
  ): Promise<ProcessTransitionValidationResult> {
    const [fromProcess, toProcess] = await Promise.all([
      this.findProcessOrThrow(fromProcessId),
      this.findProcessOrThrow(toProcessId),
    ]);

    if (!fromProcess.isActive) {
      return {
        isValid: false,
        fromProcess,
        toProcess,
        transitionType: 'INVALID',
        reason: `Starting process "${fromProcess.name}" (${fromProcess.code}) is inactive.`,
      };
    }

    if (!toProcess.isActive) {
      return {
        isValid: false,
        fromProcess,
        toProcess,
        transitionType: 'INVALID',
        reason: `Target process "${toProcess.name}" (${toProcess.code}) is inactive.`,
      };
    }

    // 1. REPEAT CHECK (same process loop)
    if (fromProcess.id === toProcess.id) {
      if (fromProcess.isRepeatable) {
        return {
          isValid: true,
          fromProcess,
          toProcess,
          transitionType: 'REPEAT',
        };
      }
      return {
        isValid: false,
        fromProcess,
        toProcess,
        transitionType: 'INVALID',
        reason: `Process "${fromProcess.name}" (${fromProcess.code}) is not repeatable.`,
      };
    }

    // 2. FORWARD TRANSITION (progression or skip)
    if (toProcess.sequenceNumber > fromProcess.sequenceNumber) {
      // Find all active processes strictly between fromProcess and toProcess
      const intermediate = await this.processRepo
        .createQueryBuilder('p')
        .where('p.isActive = true')
        .andWhere('p.sequenceNumber > :fromSeq', { fromSeq: fromProcess.sequenceNumber })
        .andWhere('p.sequenceNumber < :toSeq', { toSeq: toProcess.sequenceNumber })
        .orderBy('p.sequenceNumber', 'ASC')
        .getMany();

      // Case A: Direct adjacent successor
      if (intermediate.length === 0) {
        return {
          isValid: true,
          fromProcess,
          toProcess,
          transitionType: 'DIRECT_NEXT',
        };
      }

      // Case B: Skipping one or more intermediate steps
      const unskippable = intermediate.filter((p) => !p.isSkippable);
      if (unskippable.length > 0) {
        const names = unskippable.map((p) => `"${p.name}" (${p.code})`).join(', ');
        return {
          isValid: false,
          fromProcess,
          toProcess,
          transitionType: 'INVALID',
          skippedProcesses: intermediate,
          reason: `Cannot skip mandatory (non-skippable) process(es): ${names}.`,
        };
      }

      // All skipped processes are configured as isSkippable = true
      return {
        isValid: true,
        fromProcess,
        toProcess,
        transitionType: 'SKIP',
        skippedProcesses: intermediate,
      };
    }

    // 3. BACKWARD TRANSITION (rework / loopback)
    return {
      isValid: false,
      fromProcess,
      toProcess,
      transitionType: 'BACKWARD_REWORK',
      reason: `Backward transition from sequence ${fromProcess.sequenceNumber} ("${fromProcess.name}") to sequence ${toProcess.sequenceNumber} ("${toProcess.name}") is prohibited without an authorized rework workflow.`,
    };
  }

  /**
   * Retrieves all active processes that permit outside-vendor processing (job work).
   * Foundation for Delivery Challan (DC Type 1) routing.
   */
  async getEligibleVendorProcesses(): Promise<ProductionProcess[]> {
    return this.processRepo.find({
      where: {
        isActive: true,
        allowsOutsideVendor: true,
      },
      order: { sequenceNumber: 'ASC' },
    });
  }

  private async findProcessOrThrow(id: string): Promise<ProductionProcess> {
    const process = await this.processRepo.findOne({ where: { id } });
    if (!process) {
      throw new NotFoundException(
        `Production process with ID "${id}" was not found.`,
      );
    }
    return process;
  }
}
