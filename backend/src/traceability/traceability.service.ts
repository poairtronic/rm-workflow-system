import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { MaterialIssue, MaterialIssueType } from '../material-issue/entities/material-issue.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn, ReturnStatus } from '../production/entities/material-return.entity.js';
import { GeneralIssue, GeneralIssueStatus } from '../general-issue/entities/general-issue.entity.js';
import { QuantityCalculator } from '../common/utils/quantity-calculator.js';
import {
  FinalRmUsageResponseDto,
  FinalRmUsageSummary,
  RmUsageItemBreakdown,
} from './dto/final-rm-usage.dto.js';
import {
  RmLifecycleCategory,
  RmLifecycleFilterDto,
  RmLifecycleSummaryResponseDto,
  RmLifecycleItemDto,
  RmLifecycleCountsDto,
  RmLifecycleTotalsDto,
  RmReconciliationQueueFilterDto,
  RmReconciliationQueueResponseDto,
  RmReconciliationQueueItemDto,
  ReconciliationReason,
  PendingReturnDetailDto,
} from './dto/rm-lifecycle.dto.js';

@Injectable()
export class TraceabilityService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(MaterialIssue)
    private readonly materialIssueRepo: Repository<MaterialIssue>,
    @InjectRepository(MaterialConsumption)
    private readonly consumptionRepo: Repository<MaterialConsumption>,
    @InjectRepository(MaterialReturn)
    private readonly returnRepo: Repository<MaterialReturn>,
    @InjectRepository(GeneralIssue)
    private readonly generalIssueRepo: Repository<GeneralIssue>,
  ) {}

  /**
   * Helper to categorize raw material lifecycle state for an SC.
   */
  classifyLifecycle(status: ScStatus): RmLifecycleCategory {
    if (status === ScStatus.CLOSED) {
      return RmLifecycleCategory.CLOSED;
    }
    if (status === ScStatus.COMPLETED) {
      return RmLifecycleCategory.COMPLETED;
    }
    return RmLifecycleCategory.OPEN;
  }

  /**
   * Helper to compute core material metrics for a given SC.
   */
  private computeScMetrics(sc: SalesOrderComponent, extraGeneralIssueQty: number = 0) {
    // 1. Original RM Requested
    let originalRm = 0;
    (sc.rmItems || []).forEach((item) => {
      originalRm += Number(item.quantity) || 0;
    });
    originalRm = QuantityCalculator.roundDecimal(originalRm);

    // 2. Initial & Additional Issues
    let initialIssued = 0;
    let additionalIssued = 0;
    (sc.materialIssues || []).forEach((issue) => {
      (issue.items || []).forEach((item) => {
        const qty = Number(item.quantityIssued) || 0;
        if (issue.issueType === MaterialIssueType.INITIAL_ISSUE) {
          initialIssued += qty;
        } else if (issue.issueType === MaterialIssueType.ADDITIONAL_ISSUE) {
          additionalIssued += qty;
        }
      });
    });
    additionalIssued = QuantityCalculator.roundDecimal(additionalIssued + extraGeneralIssueQty);
    initialIssued = QuantityCalculator.roundDecimal(initialIssued);
    const totalIssued = QuantityCalculator.roundDecimal(initialIssued + additionalIssued);

    // 3. Consumed
    let totalConsumed = 0;
    (sc.materialConsumptions || []).forEach((c) => {
      totalConsumed += Number(c.consumedQuantity) || 0;
    });
    totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

    // 4. Returned (ACKNOWLEDGED vs PENDING_STORE_ACK)
    let totalReturned = 0;
    let pendingReturn = 0;
    const pendingReturnsList: PendingReturnDetailDto[] = [];

    (sc.materialReturns || []).forEach((ret) => {
      let retQty = 0;
      (ret.items || []).forEach((item) => {
        retQty += Number(item.quantityReturned) || 0;
      });
      retQty = QuantityCalculator.roundDecimal(retQty);

      if (ret.status === ReturnStatus.ACKNOWLEDGED) {
        totalReturned += retQty;
      } else if (ret.status === ReturnStatus.PENDING_STORE_ACK) {
        pendingReturn += retQty;
        pendingReturnsList.push({
          returnId: ret.id,
          quantity: retQty,
          returnedAt: ret.returnedAt ? new Date(ret.returnedAt).toISOString() : new Date().toISOString(),
          returnedBy: ret.returnedBy?.name || ret.returnedById,
          remarks: ret.remarks,
        });
      }
    });
    totalReturned = QuantityCalculator.roundDecimal(totalReturned);
    pendingReturn = QuantityCalculator.roundDecimal(pendingReturn);

    // 5. Outstanding Quantity = Total Issued - Total Consumed - Acknowledged Returns
    const outstandingQuantity = QuantityCalculator.roundDecimal(
      Math.max(0, totalIssued - totalConsumed - totalReturned),
    );

    // 6. Variance = Total Issued - Total Consumed - Acknowledged Returns
    const variance = QuantityCalculator.roundDecimal(
      totalIssued - totalConsumed - totalReturned,
    );
    const isZeroLossVerified = Math.abs(variance) < 0.001;

    // 7. Reconciliation reasons
    const reconciliationReasons: string[] = [];
    if (pendingReturn > 0) {
      reconciliationReasons.push(ReconciliationReason.PENDING_STORE_ACK_RETURN);
    }
    if (!isZeroLossVerified) {
      reconciliationReasons.push(ReconciliationReason.VARIANCE_DISCREPANCY);
    }
    if (sc.status === ScStatus.COMPLETED) {
      reconciliationReasons.push(ReconciliationReason.AWAITING_FINAL_CLOSURE);
    }

    const isPendingReconciliation = reconciliationReasons.length > 0;
    const lifecycleCategory = this.classifyLifecycle(sc.status);

    return {
      originalRm,
      initialIssued,
      additionalIssued,
      totalIssued,
      totalConsumed,
      totalReturned,
      pendingReturn,
      outstandingQuantity,
      variance,
      isZeroLossVerified,
      isPendingReconciliation,
      reconciliationReasons,
      pendingReturnsList,
      lifecycleCategory,
    };
  }

  /**
   * Phase 20.1 — Computes authoritative Final Raw Material (RM) Usage for a Sales Order Component (SC).
   */
  async getFinalRmUsage(scId: string): Promise<FinalRmUsageResponseDto> {
    const sc = await this.scRepo.findOne({
      where: { id: scId },
      relations: {
        rmItems: true,
        materialIssues: { items: true },
        materialConsumptions: true,
        materialReturns: { items: true },
      },
    });

    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${scId}" not found`);
    }

    // Also fetch any General Issues tied directly to this SC
    const generalIssues = await this.generalIssueRepo.find({
      where: { scId, status: GeneralIssueStatus.ISSUED },
      relations: { items: true },
    });

    let scGeneralIssueExtra = 0;
    generalIssues.forEach((gi) => {
      (gi.items || []).forEach((item) => {
        scGeneralIssueExtra += Number(item.quantityIssued) || 0;
      });
    });
    scGeneralIssueExtra = QuantityCalculator.roundDecimal(scGeneralIssueExtra);

    // Compute item-level breakdown
    const itemsBreakdown: RmUsageItemBreakdown[] = (sc.rmItems || []).map((rmItem) => {
      const originalRequested = QuantityCalculator.roundDecimal(Number(rmItem.quantity) || 0);

      // 1. Initial Issues
      let initialIssued = 0;
      (sc.materialIssues || []).forEach((issue) => {
        if (issue.issueType === MaterialIssueType.INITIAL_ISSUE) {
          (issue.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              initialIssued += Number(item.quantityIssued) || 0;
            }
          });
        }
      });
      initialIssued = QuantityCalculator.roundDecimal(initialIssued);

      // 2. Additional Issues
      let additionalIssued = 0;
      (sc.materialIssues || []).forEach((issue) => {
        if (issue.issueType === MaterialIssueType.ADDITIONAL_ISSUE) {
          (issue.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              additionalIssued += Number(item.quantityIssued) || 0;
            }
          });
        }
      });
      additionalIssued = QuantityCalculator.roundDecimal(additionalIssued);

      const totalIssued = QuantityCalculator.roundDecimal(initialIssued + additionalIssued);

      // 3. Consumed
      let totalConsumed = 0;
      (sc.materialConsumptions || []).forEach((c) => {
        if (c.rmItemId === rmItem.id) {
          totalConsumed += Number(c.consumedQuantity) || 0;
        }
      });
      totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

      // 4. Returned (ACKNOWLEDGED)
      let totalReturned = 0;
      (sc.materialReturns || []).forEach((ret) => {
        if (ret.status === ReturnStatus.ACKNOWLEDGED) {
          (ret.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              totalReturned += Number(item.quantityReturned) || 0;
            }
          });
        }
      });
      totalReturned = QuantityCalculator.roundDecimal(totalReturned);

      // 5. Pending Returns (PENDING_STORE_ACK)
      let pendingReturned = 0;
      (sc.materialReturns || []).forEach((ret) => {
        if (ret.status === ReturnStatus.PENDING_STORE_ACK) {
          (ret.items || []).forEach((item) => {
            if (item.rmItemId === rmItem.id) {
              pendingReturned += Number(item.quantityReturned) || 0;
            }
          });
        }
      });
      pendingReturned = QuantityCalculator.roundDecimal(pendingReturned);

      // Final RM Used: Original Requested + Additional Issued - Returned
      const finalRmUsed = QuantityCalculator.roundDecimal(
        Math.max(0, originalRequested + additionalIssued - totalReturned),
      );

      // Zero-Loss Verification Variance: Total Issued - Total Consumed - Total Returned
      const variance = QuantityCalculator.roundDecimal(
        totalIssued - totalConsumed - totalReturned,
      );
      const isZeroLossVerified = Math.abs(variance) < 0.001;

      return {
        rmItemId: rmItem.id,
        material: rmItem.material,
        grade: rmItem.grade,
        size: rmItem.size,
        uom: rmItem.weightUnit || 'KG',
        originalRequested,
        initialIssued,
        additionalIssued,
        totalIssued,
        totalConsumed,
        totalReturned,
        pendingReturned,
        finalRmUsed,
        variance,
        isZeroLossVerified,
      };
    });

    // Top-level Aggregated Summary
    const originalRm = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.originalRequested, 0),
    );
    const initialIssued = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.initialIssued, 0),
    );
    const additionalRm = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.additionalIssued, 0) + scGeneralIssueExtra,
    );
    const totalIssued = QuantityCalculator.roundDecimal(initialIssued + additionalRm);
    const totalConsumed = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.totalConsumed, 0),
    );
    const totalReturned = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.totalReturned, 0),
    );
    const pendingReturned = QuantityCalculator.roundDecimal(
      itemsBreakdown.reduce((acc, i) => acc + i.pendingReturned, 0),
    );
    const finalRmUsed = QuantityCalculator.roundDecimal(
      Math.max(0, originalRm + additionalRm - totalReturned),
    );
    const variance = QuantityCalculator.roundDecimal(
      totalIssued - totalConsumed - totalReturned,
    );
    const isZeroLossVerified = Math.abs(variance) < 0.001;

    const summary: FinalRmUsageSummary = {
      originalRm,
      initialIssued,
      additionalRm,
      totalIssued,
      totalConsumed,
      totalReturned,
      pendingReturned,
      finalRmUsed,
      variance,
      isZeroLossVerified,
    };

    return {
      scId: sc.id,
      scNumber: sc.scNumber,
      productName: sc.productName,
      targetQuantity: Number(sc.targetQuantity) || 1,
      status: sc.status,
      summary,
      items: itemsBreakdown,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 20.2 — Aggregates and reports Raw Material Lifecycle Summary across SCs.
   * Categorizes Open RM, Completed RM, Closed RM, along with Outstanding Quantities,
   * Pending Returns, and Reconciliation indicators.
   */
  async getRmLifecycleSummary(
    filterDto: RmLifecycleFilterDto,
  ): Promise<RmLifecycleSummaryResponseDto> {
    const page = filterDto.page && filterDto.page > 0 ? Number(filterDto.page) : 1;
    const limit = filterDto.limit && filterDto.limit > 0 ? Math.min(Number(filterDto.limit), 100) : 20;

    // Fetch all SCs with full relations for accurate material balance calculation
    const scs = await this.scRepo.find({
      relations: {
        purchaseOrder: { customer: true },
        rmItems: true,
        materialIssues: { items: true },
        materialConsumptions: true,
        materialReturns: { items: true, returnedBy: true },
      },
      order: { createdAt: 'DESC' },
    });

    // Fetch general issues map
    const generalIssues = await this.generalIssueRepo.find({
      where: { status: GeneralIssueStatus.ISSUED },
      relations: { items: true },
    });

    const giMap = new Map<string, number>();
    generalIssues.forEach((gi) => {
      if (gi.scId) {
        let total = giMap.get(gi.scId) || 0;
        (gi.items || []).forEach((item) => {
          total += Number(item.quantityIssued) || 0;
        });
        giMap.set(gi.scId, QuantityCalculator.roundDecimal(total));
      }
    });

    // Map each SC to RmLifecycleItemDto
    const allItems: RmLifecycleItemDto[] = [];
    const searchLower = filterDto.search ? filterDto.search.toLowerCase().trim() : undefined;
    const startTimestamp = filterDto.startDate ? new Date(filterDto.startDate).getTime() : undefined;
    const endTimestamp = filterDto.endDate ? new Date(filterDto.endDate).getTime() : undefined;

    for (const sc of scs) {
      // Date filtering
      if (startTimestamp && new Date(sc.createdAt).getTime() < startTimestamp) {
        continue;
      }
      if (endTimestamp && new Date(sc.createdAt).getTime() > endTimestamp) {
        continue;
      }

      // Search filtering
      if (searchLower) {
        const scNum = (sc.scNumber || '').toLowerCase();
        const prod = (sc.productName || '').toLowerCase();
        const poNum = (sc.purchaseOrder?.poNumber || '').toLowerCase();
        const custName = (sc.purchaseOrder?.customer?.name || '').toLowerCase();

        if (
          !scNum.includes(searchLower) &&
          !prod.includes(searchLower) &&
          !poNum.includes(searchLower) &&
          !custName.includes(searchLower)
        ) {
          continue;
        }
      }

      const extraGI = giMap.get(sc.id) || 0;
      const metrics = this.computeScMetrics(sc, extraGI);

      allItems.push({
        scId: sc.id,
        scNumber: sc.scNumber,
        poId: sc.poId,
        poNumber: sc.purchaseOrder?.poNumber,
        customerName: sc.purchaseOrder?.customer?.name,
        productName: sc.productName,
        drawingNumber: sc.drawingNumber,
        targetQuantity: Number(sc.targetQuantity) || 1,
        scStatus: sc.status,
        lifecycleCategory: metrics.lifecycleCategory,
        originalRm: metrics.originalRm,
        totalIssued: metrics.totalIssued,
        totalConsumed: metrics.totalConsumed,
        totalReturned: metrics.totalReturned,
        pendingReturn: metrics.pendingReturn,
        outstandingQuantity: metrics.outstandingQuantity,
        variance: metrics.variance,
        isZeroLossVerified: metrics.isZeroLossVerified,
        isPendingReconciliation: metrics.isPendingReconciliation,
        createdAt: new Date(sc.createdAt).toISOString(),
        completedAt: sc.completedAt ? new Date(sc.completedAt).toISOString() : undefined,
      });
    }

    // Global counts across matching items
    let openRmCount = 0;
    let completedRmCount = 0;
    let closedRmCount = 0;
    let pendingReconciliationCount = 0;

    let totalOriginalRm = 0;
    let totalIssued = 0;
    let totalConsumed = 0;
    let totalReturned = 0;
    let totalPendingReturn = 0;
    let totalOutstanding = 0;

    allItems.forEach((item) => {
      if (item.lifecycleCategory === RmLifecycleCategory.OPEN) openRmCount++;
      else if (item.lifecycleCategory === RmLifecycleCategory.COMPLETED) completedRmCount++;
      else if (item.lifecycleCategory === RmLifecycleCategory.CLOSED) closedRmCount++;

      if (item.isPendingReconciliation) pendingReconciliationCount++;

      totalOriginalRm += item.originalRm;
      totalIssued += item.totalIssued;
      totalConsumed += item.totalConsumed;
      totalReturned += item.totalReturned;
      totalPendingReturn += item.pendingReturn;
      totalOutstanding += item.outstandingQuantity;
    });

    const counts: RmLifecycleCountsDto = {
      totalSc: allItems.length,
      openRmCount,
      completedRmCount,
      closedRmCount,
      pendingReconciliationCount,
    };

    const totals: RmLifecycleTotalsDto = {
      totalOriginalRm: QuantityCalculator.roundDecimal(totalOriginalRm),
      totalIssued: QuantityCalculator.roundDecimal(totalIssued),
      totalConsumed: QuantityCalculator.roundDecimal(totalConsumed),
      totalReturned: QuantityCalculator.roundDecimal(totalReturned),
      totalPendingReturn: QuantityCalculator.roundDecimal(totalPendingReturn),
      totalOutstanding: QuantityCalculator.roundDecimal(totalOutstanding),
    };

    // Filter by category if requested
    let filteredItems = allItems;
    if (filterDto.category) {
      filteredItems = allItems.filter((i) => i.lifecycleCategory === filterDto.category);
    }

    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

    return {
      counts,
      totals,
      data: paginatedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Phase 20.2 — Retrieves the raw material reconciliation queue.
   * Lists SCs that have pending store-ack returns, unresolved variances, or are awaiting final closure.
   */
  async getRmReconciliationQueue(
    filterDto: RmReconciliationQueueFilterDto,
  ): Promise<RmReconciliationQueueResponseDto> {
    const page = filterDto.page && filterDto.page > 0 ? Number(filterDto.page) : 1;
    const limit = filterDto.limit && filterDto.limit > 0 ? Math.min(Number(filterDto.limit), 100) : 20;

    const scs = await this.scRepo.find({
      relations: {
        purchaseOrder: { customer: true },
        rmItems: true,
        materialIssues: { items: true },
        materialConsumptions: true,
        materialReturns: { items: true, returnedBy: true },
      },
      order: { createdAt: 'DESC' },
    });

    // Fetch general issues map
    const generalIssues = await this.generalIssueRepo.find({
      where: { status: GeneralIssueStatus.ISSUED },
      relations: { items: true },
    });

    const giMap = new Map<string, number>();
    generalIssues.forEach((gi) => {
      if (gi.scId) {
        let total = giMap.get(gi.scId) || 0;
        (gi.items || []).forEach((item) => {
          total += Number(item.quantityIssued) || 0;
        });
        giMap.set(gi.scId, QuantityCalculator.roundDecimal(total));
      }
    });

    const queueItems: RmReconciliationQueueItemDto[] = [];
    const searchLower = filterDto.search ? filterDto.search.toLowerCase().trim() : undefined;

    for (const sc of scs) {
      // Search filtering
      if (searchLower) {
        const scNum = (sc.scNumber || '').toLowerCase();
        const prod = (sc.productName || '').toLowerCase();
        const poNum = (sc.purchaseOrder?.poNumber || '').toLowerCase();
        const custName = (sc.purchaseOrder?.customer?.name || '').toLowerCase();

        if (
          !scNum.includes(searchLower) &&
          !prod.includes(searchLower) &&
          !poNum.includes(searchLower) &&
          !custName.includes(searchLower)
        ) {
          continue;
        }
      }

      const extraGI = giMap.get(sc.id) || 0;
      const metrics = this.computeScMetrics(sc, extraGI);

      // Must require reconciliation to be in the queue
      if (!metrics.isPendingReconciliation) {
        continue;
      }

      // Filter by specific reason if provided
      if (filterDto.reason && filterDto.reason !== ReconciliationReason.ALL) {
        if (!metrics.reconciliationReasons.includes(filterDto.reason)) {
          continue;
        }
      }

      queueItems.push({
        scId: sc.id,
        scNumber: sc.scNumber,
        poId: sc.poId,
        poNumber: sc.purchaseOrder?.poNumber,
        customerName: sc.purchaseOrder?.customer?.name,
        productName: sc.productName,
        scStatus: sc.status,
        lifecycleCategory: metrics.lifecycleCategory,
        originalRm: metrics.originalRm,
        totalIssued: metrics.totalIssued,
        totalConsumed: metrics.totalConsumed,
        totalReturned: metrics.totalReturned,
        pendingReturn: metrics.pendingReturn,
        outstandingQuantity: metrics.outstandingQuantity,
        variance: metrics.variance,
        reconciliationReasons: metrics.reconciliationReasons,
        pendingReturns: metrics.pendingReturnsList,
        completedAt: sc.completedAt ? new Date(sc.completedAt).toISOString() : undefined,
        createdAt: new Date(sc.createdAt).toISOString(),
      });
    }

    // Sort queue items: pending returns first, then by variance discrepancy
    queueItems.sort((a, b) => {
      if (b.pendingReturn !== a.pendingReturn) {
        return b.pendingReturn - a.pendingReturn;
      }
      return Math.abs(b.variance) - Math.abs(a.variance);
    });

    const total = queueItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const paginatedItems = queueItems.slice((page - 1) * limit, page * limit);

    return {
      total,
      page,
      limit,
      totalPages,
      items: paginatedItems,
    };
  }
}
