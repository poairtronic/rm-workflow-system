import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalesOrderComponent, ScStatus } from '../sc/entities/sc.entity.js';
import { PurchaseOrder } from '../po/entities/po.entity.js';
import { RmRequest } from '../rm/entities/rm-request.entity.js';
import { MaterialIssue, MaterialIssueType } from '../material-issue/entities/material-issue.entity.js';
import { MaterialReceipt } from '../production/entities/production-receipt.entity.js';
import { MaterialConsumption } from '../production/entities/material-consumption.entity.js';
import { MaterialReturn, ReturnStatus } from '../production/entities/material-return.entity.js';
import { AdditionalMaterialRequest } from '../additional-request/entities/additional-request.entity.js';
import { StockTransaction, TransactionType } from '../inventory/entities/stock-transaction.entity.js';
import { DeliveryChallan, DeliveryChallanStatus } from '../delivery-challan/entities/delivery-challan.entity.js';
import { ProductionProcess } from '../production-process/entities/production-process.entity.js';
import { Vendor } from '../vendor/entities/vendor.entity.js';
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
import {
  ConsolidatedScTraceabilityDto,
  ConsolidatedScMetaDto,
  ConsolidatedPoDto,
  ConsolidatedRmRequestDto,
  ConsolidatedIssueDto,
  ConsolidatedReceiptDto,
  ConsolidatedConsumptionDto,
  ConsolidatedReturnDto,
  ConsolidatedAdditionalRequestDto,
  ConsolidatedInventoryTransactionDto,
  ConsolidatedProcessStepDto,
  ConsolidatedDeliveryChallanDto,
  ConsolidatedVendorDto,
} from './dto/consolidated-sc-traceability.dto.js';
import {
  ConsolidatedPoTraceabilityDto,
  PoChildComponentNodeDto,
} from './dto/consolidated-po-traceability.dto.js';

@Injectable()
export class TraceabilityService {
  constructor(
    @InjectRepository(SalesOrderComponent)
    private readonly scRepo: Repository<SalesOrderComponent>,
    @InjectRepository(PurchaseOrder)
    private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(RmRequest)
    private readonly rmReqRepo: Repository<RmRequest>,
    @InjectRepository(MaterialIssue)
    private readonly materialIssueRepo: Repository<MaterialIssue>,
    @InjectRepository(MaterialReceipt)
    private readonly materialReceiptRepo: Repository<MaterialReceipt>,
    @InjectRepository(MaterialConsumption)
    private readonly consumptionRepo: Repository<MaterialConsumption>,
    @InjectRepository(MaterialReturn)
    private readonly returnRepo: Repository<MaterialReturn>,
    @InjectRepository(AdditionalMaterialRequest)
    private readonly additionalRequestRepo: Repository<AdditionalMaterialRequest>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepo: Repository<StockTransaction>,
    @InjectRepository(DeliveryChallan)
    private readonly deliveryChallanRepo: Repository<DeliveryChallan>,
    @InjectRepository(ProductionProcess)
    private readonly processRepo: Repository<ProductionProcess>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
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
    let originalRm = 0;
    (sc.rmItems || []).forEach((item) => {
      originalRm += Number(item.quantity) || 0;
    });
    originalRm = QuantityCalculator.roundDecimal(originalRm);

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

    let totalConsumed = 0;
    (sc.materialConsumptions || []).forEach((c) => {
      totalConsumed += Number(c.consumedQuantity) || 0;
    });
    totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

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

    const outstandingQuantity = QuantityCalculator.roundDecimal(
      Math.max(0, totalIssued - totalConsumed - totalReturned),
    );

    const variance = QuantityCalculator.roundDecimal(
      totalIssued - totalConsumed - totalReturned,
    );
    const isZeroLossVerified = Math.abs(variance) < 0.001;

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

    const itemsBreakdown: RmUsageItemBreakdown[] = (sc.rmItems || []).map((rmItem) => {
      const originalRequested = QuantityCalculator.roundDecimal(Number(rmItem.quantity) || 0);

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

      let totalConsumed = 0;
      (sc.materialConsumptions || []).forEach((c) => {
        if (c.rmItemId === rmItem.id) {
          totalConsumed += Number(c.consumedQuantity) || 0;
        }
      });
      totalConsumed = QuantityCalculator.roundDecimal(totalConsumed);

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

      const finalRmUsed = QuantityCalculator.roundDecimal(
        Math.max(0, originalRequested + additionalIssued - totalReturned),
      );

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
   */
  async getRmLifecycleSummary(
    filterDto: RmLifecycleFilterDto,
  ): Promise<RmLifecycleSummaryResponseDto> {
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

    const allItems: RmLifecycleItemDto[] = [];
    const searchLower = filterDto.search ? filterDto.search.toLowerCase().trim() : undefined;
    const startTimestamp = filterDto.startDate ? new Date(filterDto.startDate).getTime() : undefined;
    const endTimestamp = filterDto.endDate ? new Date(filterDto.endDate).getTime() : undefined;

    for (const sc of scs) {
      if (startTimestamp && new Date(sc.createdAt).getTime() < startTimestamp) {
        continue;
      }
      if (endTimestamp && new Date(sc.createdAt).getTime() > endTimestamp) {
        continue;
      }

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

      if (!metrics.isPendingReconciliation) {
        continue;
      }

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

  /**
   * Phase 20.3 — Build the comprehensive, single-call consolidated traceability API for a Sales Order Component (SC).
   * Aggregates SC metadata, parent PO, RM requests, material issues, store receipts, consumptions, returns,
   * additional material requests, immutable stock transactions, production processes, delivery challans,
   * participating vendors, and authoritative Final RM usage calculation.
   */
  async getConsolidatedScTraceability(scId: string): Promise<ConsolidatedScTraceabilityDto> {
    const sc = await this.scRepo.findOne({
      where: { id: scId },
      relations: {
        purchaseOrder: { customer: true },
        rmItems: true,
        completedBy: true,
      },
    });

    if (!sc) {
      throw new NotFoundException(`Sales Order Component with ID "${scId}" not found`);
    }

    // 1. RM Requests
    const rmRequests = await this.rmReqRepo.find({
      where: { scId },
      relations: { items: true, createdBy: true, reviewedBy: true },
      order: { revisionNumber: 'ASC' },
    });

    // 2. Material Issues
    const issues = await this.materialIssueRepo.find({
      where: { scId },
      relations: { items: true, issuedBy: true },
      order: { issueDate: 'ASC' },
    });
    const issueIds = issues.map((i) => i.id);

    // 3. Material Receipts (Inward store receipts for this SC's issues)
    let receipts: MaterialReceipt[] = [];
    if (issueIds.length > 0) {
      receipts = await this.materialReceiptRepo.find({
        where: { materialIssueId: In(issueIds) },
        relations: { items: true, receivedBy: true },
        order: { receivedAt: 'ASC' },
      });
    }

    // 4. Consumptions
    const consumptions = await this.consumptionRepo.find({
      where: { scId },
      relations: { recordedBy: true },
      order: { recordedAt: 'ASC' },
    });

    // 5. Returns
    const returns = await this.returnRepo.find({
      where: { scId },
      relations: { items: true, returnedBy: true, confirmedBy: true },
      order: { returnedAt: 'ASC' },
    });
    const returnIds = returns.map((r) => r.id);

    // 6. Additional Material Requests
    const additionalRequests = await this.additionalRequestRepo.find({
      where: { scId },
      relations: { items: true, requestedBy: true, approvedBy: true },
      order: { requestedAt: 'ASC' },
    });

    // 7. Delivery Challans
    const deliveryChallans = await this.deliveryChallanRepo.find({
      where: { scId },
      relations: { vendor: true, process: true, items: { product: true } },
      order: { dispatchDate: 'ASC' },
    });
    const dcIds = deliveryChallans.map((d) => d.id);

    // 8. General Issues linked to SC
    const generalIssues = await this.generalIssueRepo.find({
      where: { scId },
      relations: { items: true },
    });
    const giIds = generalIssues.map((g) => g.id);

    // 9. Stock Transactions (Immutable ledger records tied to this SC and related operations)
    const relatedIds = Array.from(
      new Set([sc.id, ...issueIds, ...returnIds, ...dcIds, ...giIds].filter(Boolean)),
    );
    let stockTransactions: StockTransaction[] = [];
    if (relatedIds.length > 0) {
      stockTransactions = await this.stockTransactionRepo.find({
        where: { referenceId: In(relatedIds) },
        relations: { product: true, createdBy: true },
        order: { createdAt: 'DESC' },
      });
    }

    // 10. Production Processes
    const allProcesses = await this.processRepo.find({
      where: { isActive: true },
      order: { sequenceNumber: 'ASC' },
    });
    const productionProcesses: ConsolidatedProcessStepDto[] = allProcesses.map((p) => {
      const linkedDcs = deliveryChallans.filter((dc) => dc.processId === p.id);
      const vendorsForProcess = Array.from(
        new Set(linkedDcs.map((dc) => dc.vendor?.name).filter(Boolean)),
      ) as string[];

      let status = 'INTERNAL_OR_PENDING';
      if (linkedDcs.length > 0) {
        const allClosed = linkedDcs.every(
          (dc) => dc.status === 'CLOSED' || dc.status === 'RETURNED',
        );
        const anyDispatched = linkedDcs.some(
          (dc) => dc.status === 'DISPATCHED' || dc.status === 'PARTIALLY_RETURNED',
        );
        if (allClosed) {
          status = 'COMPLETED';
        } else if (anyDispatched) {
          status = 'DISPATCHED';
        } else {
          status = 'OPEN';
        }
      }

      return {
        processId: p.id,
        name: p.name,
        code: p.code,
        sequenceNumber: p.sequenceNumber,
        allowsOutsideVendor: p.allowsOutsideVendor,
        status,
        deliveryChallanCount: linkedDcs.length,
        vendorNames: vendorsForProcess,
      };
    });

    // 11. Deduplicated Participating Vendors
    const vendorMap = new Map<string, { vendor: Vendor; total: number; active: number }>();
    deliveryChallans.forEach((dc) => {
      if (dc.vendor) {
        let entry = vendorMap.get(dc.vendor.id);
        if (!entry) {
          entry = { vendor: dc.vendor, total: 0, active: 0 };
          vendorMap.set(dc.vendor.id, entry);
        }
        entry.total++;
        if (dc.status !== 'CLOSED' && dc.status !== 'RETURNED') {
          entry.active++;
        }
      }
    });

    const vendors: ConsolidatedVendorDto[] = Array.from(vendorMap.values()).map((v) => ({
      id: v.vendor.id,
      name: v.vendor.name,
      code: v.vendor.code,
      contactPerson: v.vendor.contactPerson || undefined,
      email: v.vendor.email || undefined,
      phone: v.vendor.phone || undefined,
      totalChallans: v.total,
      activeChallans: v.active,
    }));

    // 12. Authoritative Final RM Usage from Phase 20.1
    const finalRmUsageResponse = await this.getFinalRmUsage(sc.id);

    // Build the consolidated response payload
    const scMeta: ConsolidatedScMetaDto = {
      id: sc.id,
      scNumber: sc.scNumber,
      productName: sc.productName,
      drawingNumber: sc.drawingNumber,
      description: sc.description,
      targetQuantity: Number(sc.targetQuantity) || 1,
      status: sc.status,
      createdAt: new Date(sc.createdAt).toISOString(),
      updatedAt: new Date(sc.updatedAt).toISOString(),
      completedAt: sc.completedAt ? new Date(sc.completedAt).toISOString() : undefined,
      completedBy: sc.completedBy
        ? {
            id: sc.completedBy.id,
            name: sc.completedBy.name,
            email: sc.completedBy.email,
          }
        : undefined,
      completionRemarks: sc.completionRemarks,
    };

    const poMeta: ConsolidatedPoDto = {
      id: sc.purchaseOrder?.id || sc.poId,
      poNumber: sc.purchaseOrder?.poNumber || 'UNKNOWN',
      externalReference: sc.purchaseOrder?.externalReference,
      referenceDate: sc.purchaseOrder?.referenceDate
        ? new Date(sc.purchaseOrder.referenceDate).toISOString()
        : undefined,
      remarks: sc.purchaseOrder?.remarks,
      customer: sc.purchaseOrder?.customer
        ? {
            id: sc.purchaseOrder.customer.id,
            code: sc.purchaseOrder.customer.code,
            name: sc.purchaseOrder.customer.name,
            email: sc.purchaseOrder.customer.email,
            phone: sc.purchaseOrder.customer.phone,
          }
        : undefined,
    };

    const rmRequestsDto: ConsolidatedRmRequestDto[] = rmRequests.map((req) => ({
      id: req.id,
      formType: req.formType,
      status: req.status,
      revisionNumber: req.revisionNumber,
      submittedAt: req.submittedAt ? new Date(req.submittedAt).toISOString() : undefined,
      reviewedAt: req.reviewedAt ? new Date(req.reviewedAt).toISOString() : undefined,
      completedAt: req.completedAt ? new Date(req.completedAt).toISOString() : undefined,
      createdBy: req.createdBy ? { id: req.createdBy.id, name: req.createdBy.name } : undefined,
      reviewedBy: req.reviewedBy ? { id: req.reviewedBy.id, name: req.reviewedBy.name } : undefined,
      items: (req.items || []).map((item) => ({
        id: item.id,
        material: item.material,
        materialType: item.materialType,
        grade: item.grade,
        size: item.size,
        quantity: Number(item.quantity) || 0,
        weightUnit: item.weightUnit || 'KG',
        remarks: item.remarks,
      })),
    }));

    const issuesDto: ConsolidatedIssueDto[] = issues.map((iss) => ({
      id: iss.id,
      issueNumber: iss.issueNumber,
      issueType: iss.issueType,
      issueDate: new Date(iss.issueDate).toISOString(),
      issuedBy: iss.issuedBy ? { id: iss.issuedBy.id, name: iss.issuedBy.name } : undefined,
      remarks: iss.remarks,
      items: (iss.items || []).map((item) => ({
        id: item.id,
        rmItemId: item.rmItemId,
        quantityIssued: Number(item.quantityIssued) || 0,
        remarks: item.remarks,
      })),
    }));

    const receiptsDto: ConsolidatedReceiptDto[] = receipts.map((rec) => ({
      id: rec.id,
      materialIssueId: rec.materialIssueId,
      status: rec.status,
      receivedAt: new Date(rec.receivedAt).toISOString(),
      receivedBy: rec.receivedBy ? { id: rec.receivedBy.id, name: rec.receivedBy.name } : undefined,
      remarks: rec.remarks,
      items: (rec.items || []).map((item) => ({
        id: item.id,
        rmItemId: item.rmItemId,
        quantityReceived: Number(item.quantityReceived) || 0,
        remarks: item.remarks,
      })),
    }));

    const consumptionDto: ConsolidatedConsumptionDto[] = consumptions.map((c) => ({
      id: c.id,
      rmItemId: c.rmItemId,
      consumedQuantity: Number(c.consumedQuantity) || 0,
      unit: c.unit,
      recordedAt: new Date(c.recordedAt).toISOString(),
      recordedBy: c.recordedBy ? { id: c.recordedBy.id, name: c.recordedBy.name } : undefined,
      remarks: c.remarks,
    }));

    const returnsDto: ConsolidatedReturnDto[] = returns.map((r) => ({
      id: r.id,
      status: r.status,
      returnedAt: new Date(r.returnedAt).toISOString(),
      returnedBy: r.returnedBy ? { id: r.returnedBy.id, name: r.returnedBy.name } : undefined,
      confirmedAt: r.confirmedAt ? new Date(r.confirmedAt).toISOString() : undefined,
      confirmedBy: r.confirmedBy ? { id: r.confirmedBy.id, name: r.confirmedBy.name } : undefined,
      remarks: r.remarks,
      items: (r.items || []).map((item) => ({
        id: item.id,
        rmItemId: item.rmItemId,
        quantityReturned: Number(item.quantityReturned) || 0,
        remarks: item.remarks,
      })),
    }));

    const additionalMaterialDto: ConsolidatedAdditionalRequestDto[] = additionalRequests.map((a) => ({
      id: a.id,
      status: a.status,
      reason: a.reason,
      requestedAt: new Date(a.requestedAt).toISOString(),
      requestedBy: a.requestedBy ? { id: a.requestedBy.id, name: a.requestedBy.name } : undefined,
      approvedAt: a.approvedAt ? new Date(a.approvedAt).toISOString() : undefined,
      approvedBy: a.approvedBy ? { id: a.approvedBy.id, name: a.approvedBy.name } : undefined,
      remarks: a.remarks,
      items: (a.items || []).map((item) => ({
        id: item.id,
        rmItemId: item.rmItemId,
        requestedQuantity: Number(item.quantityRequested) || 0,
        approvedQuantity: item.quantityApproved ? Number(item.quantityApproved) : undefined,
        remarks: item.remarks,
      })),
    }));

    const inventoryTransactionsDto: ConsolidatedInventoryTransactionDto[] = stockTransactions.map((tx) => ({
      id: tx.id,
      transactionType: tx.transactionType,
      quantity: Number(tx.quantity) || 0,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdAt: new Date(tx.createdAt).toISOString(),
      createdBy: tx.createdBy ? { id: tx.createdBy.id, name: tx.createdBy.name } : undefined,
      product: tx.product ? { id: tx.product.id, name: tx.product.name } : undefined,
      remarks: tx.remarks,
    }));

    const deliveryChallansDto: ConsolidatedDeliveryChallanDto[] = deliveryChallans.map((dc) => ({
      id: dc.id,
      challanNumber: dc.challanNumber,
      type: dc.type,
      status: dc.status,
      dispatchDate: new Date(dc.dispatchDate).toISOString(),
      expectedReturnDate: dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toISOString() : undefined,
      actualReturnDate: dc.actualReturnDate ? new Date(dc.actualReturnDate).toISOString() : undefined,
      vendor: dc.vendor ? { id: dc.vendor.id, name: dc.vendor.name, code: dc.vendor.code } : undefined,
      process: dc.process ? { id: dc.process.id, name: dc.process.name, code: dc.process.code } : undefined,
      items: (dc.items || []).map((item) => {
        const quantityDispatched = Number(item.quantityDispatched) || 0;
        const quantityReturned = Number(item.quantityReturned) || 0;
        const balanceQuantity = QuantityCalculator.roundDecimal(Math.max(0, quantityDispatched - quantityReturned));
        return {
          id: item.id,
          productId: item.productId,
          productName: item.product?.name,
          quantityDispatched,
          quantityReturned,
          balanceQuantity,
        };
      }),
    }));

    return {
      sc: scMeta,
      po: poMeta,
      rmRequests: rmRequestsDto,
      issues: issuesDto,
      receipts: receiptsDto,
      consumption: consumptionDto,
      returns: returnsDto,
      additionalMaterial: additionalMaterialDto,
      inventoryTransactions: inventoryTransactionsDto,
      productionProcesses,
      deliveryChallans: deliveryChallansDto,
      vendors,
      finalRmUsage: {
        summary: finalRmUsageResponse.summary,
        items: finalRmUsageResponse.items,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Phase 20.4 — Build the comprehensive, top-level PO Consolidated Traceability API.
   * Aggregates all child SCs tied to a Purchase Order, computing macro-level summaries,
   * child SC breakdowns, cumulative RM usage, inventory transaction activity, production routing,
   * delivery challans, and engaged vendors across the entire order.
   */
  async getConsolidatedPoTraceability(poId: string): Promise<ConsolidatedPoTraceabilityDto> {
    const po = await this.poRepo.findOne({
      where: { id: poId },
      relations: { customer: true },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order with ID "${poId}" not found`);
    }

    const scs = await this.scRepo.find({
      where: { poId },
      relations: {
        rmItems: true,
        materialIssues: { items: true },
        materialConsumptions: true,
        materialReturns: { items: true, returnedBy: true },
      },
      order: { createdAt: 'ASC' },
    });
    const scIds = scs.map((s) => s.id);

    // Fetch General Issues linked to child SCs or PO
    const generalIssues = await this.generalIssueRepo.find({
      where: [
        ...(scIds.length > 0 ? [{ scId: In(scIds), status: GeneralIssueStatus.ISSUED }] : []),
        { poId, status: GeneralIssueStatus.ISSUED },
      ],
      relations: { items: true },
    });

    const giMap = new Map<string, number>();
    const giIds: string[] = [];
    generalIssues.forEach((gi) => {
      giIds.push(gi.id);
      if (gi.scId) {
        let total = giMap.get(gi.scId) || 0;
        (gi.items || []).forEach((item) => {
          total += Number(item.quantityIssued) || 0;
        });
        giMap.set(gi.scId, QuantityCalculator.roundDecimal(total));
      }
    });

    // Delivery Challans linked to child SCs
    let deliveryChallans: DeliveryChallan[] = [];
    if (scIds.length > 0) {
      deliveryChallans = await this.deliveryChallanRepo.find({
        where: { scId: In(scIds) },
        relations: { vendor: true, process: true, items: { product: true } },
        order: { dispatchDate: 'ASC' },
      });
    }
    const dcIds = deliveryChallans.map((d) => d.id);

    // Stock Transactions tied to PO or its child components
    const issueIds: string[] = [];
    const returnIds: string[] = [];
    scs.forEach((sc) => {
      (sc.materialIssues || []).forEach((i) => issueIds.push(i.id));
      (sc.materialReturns || []).forEach((r) => returnIds.push(r.id));
    });

    const relatedIds = Array.from(
      new Set([po.id, ...scIds, ...issueIds, ...returnIds, ...dcIds, ...giIds].filter(Boolean)),
    );

    let stockTransactions: StockTransaction[] = [];
    if (relatedIds.length > 0) {
      stockTransactions = await this.stockTransactionRepo.find({
        where: { referenceId: In(relatedIds) },
        relations: { product: true, createdBy: true },
        order: { createdAt: 'DESC' },
      });
    }

    // Process Steps definition
    const allProcesses = await this.processRepo.find({
      where: { isActive: true },
      order: { sequenceNumber: 'ASC' },
    });
    const activeProcesses: ConsolidatedProcessStepDto[] = allProcesses.map((p) => {
      const linkedDcs = deliveryChallans.filter((dc) => dc.processId === p.id);
      const vendorsForProcess = Array.from(
        new Set(linkedDcs.map((dc) => dc.vendor?.name).filter(Boolean)),
      ) as string[];

      let status = 'INTERNAL_OR_PENDING';
      if (linkedDcs.length > 0) {
        const allClosed = linkedDcs.every(
          (dc) => dc.status === DeliveryChallanStatus.CLOSED || dc.status === DeliveryChallanStatus.RETURNED,
        );
        const anyDispatched = linkedDcs.some(
          (dc) => dc.status === DeliveryChallanStatus.DISPATCHED || dc.status === DeliveryChallanStatus.PARTIALLY_RETURNED,
        );
        if (allClosed) {
          status = 'COMPLETED';
        } else if (anyDispatched) {
          status = 'DISPATCHED';
        } else {
          status = 'OPEN';
        }
      }

      return {
        processId: p.id,
        name: p.name,
        code: p.code,
        sequenceNumber: p.sequenceNumber,
        allowsOutsideVendor: p.allowsOutsideVendor,
        status,
        deliveryChallanCount: linkedDcs.length,
        vendorNames: vendorsForProcess,
      };
    });

    // Deduplicated Vendors across all child SC DCs
    const vendorMap = new Map<string, { vendor: Vendor; total: number; active: number }>();
    deliveryChallans.forEach((dc) => {
      if (dc.vendor) {
        let entry = vendorMap.get(dc.vendor.id);
        if (!entry) {
          entry = { vendor: dc.vendor, total: 0, active: 0 };
          vendorMap.set(dc.vendor.id, entry);
        }
        entry.total++;
        if (dc.status !== DeliveryChallanStatus.CLOSED && dc.status !== DeliveryChallanStatus.RETURNED) {
          entry.active++;
        }
      }
    });

    const vendors: ConsolidatedVendorDto[] = Array.from(vendorMap.values()).map((v) => ({
      id: v.vendor.id,
      name: v.vendor.name,
      code: v.vendor.code,
      contactPerson: v.vendor.contactPerson || undefined,
      email: v.vendor.email || undefined,
      phone: v.vendor.phone || undefined,
      totalChallans: v.total,
      activeChallans: v.active,
    }));

    // Map Child Component Nodes and accumulate metrics
    const statusBreakdown: Record<string, number> = {};
    const childComponents: PoChildComponentNodeDto[] = [];

    let totalOriginalRm = 0;
    let totalInitialIssued = 0;
    let totalAdditionalIssued = 0;
    let totalIssued = 0;
    let totalConsumed = 0;
    let totalReturned = 0;
    let totalPendingReturn = 0;
    let totalFinalRmUsed = 0;
    let totalVariance = 0;
    let openScCount = 0;
    let completedScCount = 0;
    let closedScCount = 0;
    let totalTargetQuantity = 0;
    let completedTargetQuantity = 0;

    for (const sc of scs) {
      statusBreakdown[sc.status] = (statusBreakdown[sc.status] || 0) + 1;
      const targetQty = Number(sc.targetQuantity) || 1;
      totalTargetQuantity += targetQty;

      const extraGI = giMap.get(sc.id) || 0;
      const metrics = this.computeScMetrics(sc, extraGI);

      if (metrics.lifecycleCategory === RmLifecycleCategory.OPEN) {
        openScCount++;
      } else if (metrics.lifecycleCategory === RmLifecycleCategory.COMPLETED) {
        completedScCount++;
        completedTargetQuantity += targetQty;
      } else if (metrics.lifecycleCategory === RmLifecycleCategory.CLOSED) {
        closedScCount++;
        completedTargetQuantity += targetQty;
      }

      const scFinalRmUsed = QuantityCalculator.roundDecimal(
        Math.max(0, metrics.originalRm + metrics.additionalIssued - metrics.totalReturned),
      );

      totalOriginalRm += metrics.originalRm;
      totalInitialIssued += metrics.initialIssued;
      totalAdditionalIssued += metrics.additionalIssued;
      totalIssued += metrics.totalIssued;
      totalConsumed += metrics.totalConsumed;
      totalReturned += metrics.totalReturned;
      totalPendingReturn += metrics.pendingReturn;
      totalFinalRmUsed += scFinalRmUsed;
      totalVariance += metrics.variance;

      const childDcs = deliveryChallans.filter((d) => d.scId === sc.id);
      const childVendors = Array.from(
        new Set(childDcs.map((d) => d.vendor?.name).filter(Boolean)),
      ) as string[];

      childComponents.push({
        scId: sc.id,
        scNumber: sc.scNumber,
        productName: sc.productName,
        drawingNumber: sc.drawingNumber,
        targetQuantity: targetQty,
        status: sc.status,
        lifecycleCategory: metrics.lifecycleCategory,
        rmSummary: {
          originalRm: metrics.originalRm,
          initialIssued: metrics.initialIssued,
          additionalRm: metrics.additionalIssued,
          totalIssued: metrics.totalIssued,
          totalConsumed: metrics.totalConsumed,
          totalReturned: metrics.totalReturned,
          pendingReturned: metrics.pendingReturn,
          finalRmUsed: scFinalRmUsed,
          variance: metrics.variance,
          isZeroLossVerified: metrics.isZeroLossVerified,
        },
        deliveryChallanCount: childDcs.length,
        vendorNames: childVendors,
        isZeroLossVerified: metrics.isZeroLossVerified,
        isPendingReconciliation: metrics.isPendingReconciliation,
        createdAt: new Date(sc.createdAt).toISOString(),
        completedAt: sc.completedAt ? new Date(sc.completedAt).toISOString() : undefined,
      });
    }

    const totalScCount = scs.length;
    totalTargetQuantity = QuantityCalculator.roundDecimal(totalTargetQuantity);
    completedTargetQuantity = QuantityCalculator.roundDecimal(completedTargetQuantity);

    const overallFulfillmentPercentage = totalTargetQuantity > 0
      ? QuantityCalculator.roundDecimal((completedTargetQuantity / totalTargetQuantity) * 100)
      : (totalScCount > 0 ? QuantityCalculator.roundDecimal(((completedScCount + closedScCount) / totalScCount) * 100) : 0);

    const totalOutstanding = QuantityCalculator.roundDecimal(
      Math.max(0, totalIssued - totalConsumed - totalReturned),
    );

    const isAllZeroLossVerified = childComponents.length > 0
      ? childComponents.every((c) => c.isZeroLossVerified)
      : true;

    // Inventory transactions aggregation
    let totalStockOut = 0;
    let totalStockIn = 0;
    stockTransactions.forEach((tx) => {
      const q = Number(tx.quantity) || 0;
      if (tx.transactionType === TransactionType.STOCK_OUT || tx.transactionType === TransactionType.STORES_ISSUE) {
        totalStockOut += q;
      } else if (tx.transactionType === TransactionType.STOCK_IN || tx.transactionType === TransactionType.RETURN) {
        totalStockIn += q;
      }
    });

    // Delivery Challans summary
    let dispatchedChallans = 0;
    let closedChallans = 0;
    deliveryChallans.forEach((dc) => {
      if (dc.status === DeliveryChallanStatus.DISPATCHED || dc.status === DeliveryChallanStatus.PARTIALLY_RETURNED) {
        dispatchedChallans++;
      } else if (dc.status === DeliveryChallanStatus.CLOSED || dc.status === DeliveryChallanStatus.RETURNED) {
        closedChallans++;
      }
    });

    return {
      po: {
        id: po.id,
        poNumber: po.poNumber,
        externalReference: po.externalReference,
        referenceDate: po.referenceDate ? new Date(po.referenceDate).toISOString() : undefined,
        remarks: po.remarks,
        customer: po.customer
          ? {
              id: po.customer.id,
              code: po.customer.code,
              name: po.customer.name,
              email: po.customer.email,
              phone: po.customer.phone,
            }
          : undefined,
        createdAt: new Date(po.createdAt).toISOString(),
        updatedAt: new Date(po.updatedAt).toISOString(),
      },
      summary: {
        totalScCount,
        openScCount,
        completedScCount,
        closedScCount,
        totalTargetQuantity,
        completedTargetQuantity,
        overallFulfillmentPercentage,
      },
      rmSummary: {
        totalOriginalRm: QuantityCalculator.roundDecimal(totalOriginalRm),
        totalInitialIssued: QuantityCalculator.roundDecimal(totalInitialIssued),
        totalAdditionalIssued: QuantityCalculator.roundDecimal(totalAdditionalIssued),
        totalIssued: QuantityCalculator.roundDecimal(totalIssued),
        totalConsumed: QuantityCalculator.roundDecimal(totalConsumed),
        totalReturned: QuantityCalculator.roundDecimal(totalReturned),
        totalPendingReturn: QuantityCalculator.roundDecimal(totalPendingReturn),
        totalOutstanding,
        totalFinalRmUsed: QuantityCalculator.roundDecimal(totalFinalRmUsed),
        totalVariance: QuantityCalculator.roundDecimal(totalVariance),
        isAllZeroLossVerified,
      },
      inventorySummary: {
        totalTransactions: stockTransactions.length,
        totalStockOut: QuantityCalculator.roundDecimal(totalStockOut),
        totalStockIn: QuantityCalculator.roundDecimal(totalStockIn),
        transactions: stockTransactions.map((tx) => ({
          id: tx.id,
          transactionType: tx.transactionType,
          quantity: Number(tx.quantity) || 0,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          createdAt: new Date(tx.createdAt).toISOString(),
          createdBy: tx.createdBy ? { id: tx.createdBy.id, name: tx.createdBy.name } : undefined,
          product: tx.product ? { id: tx.product.id, name: tx.product.name } : undefined,
          remarks: tx.remarks,
        })),
      },
      productionStatus: {
        totalTargetQuantity,
        completedTargetQuantity,
        statusBreakdown,
        activeProcesses,
      },
      deliveryChallans: {
        totalChallans: deliveryChallans.length,
        dispatchedChallans,
        closedChallans,
        items: deliveryChallans.map((dc) => ({
          id: dc.id,
          challanNumber: dc.challanNumber,
          type: dc.type,
          status: dc.status,
          dispatchDate: new Date(dc.dispatchDate).toISOString(),
          expectedReturnDate: dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toISOString() : undefined,
          actualReturnDate: dc.actualReturnDate ? new Date(dc.actualReturnDate).toISOString() : undefined,
          vendor: dc.vendor ? { id: dc.vendor.id, name: dc.vendor.name, code: dc.vendor.code } : undefined,
          process: dc.process ? { id: dc.process.id, name: dc.process.name, code: dc.process.code } : undefined,
          items: (dc.items || []).map((item) => {
            const quantityDispatched = Number(item.quantityDispatched) || 0;
            const quantityReturned = Number(item.quantityReturned) || 0;
            const balanceQuantity = QuantityCalculator.roundDecimal(Math.max(0, quantityDispatched - quantityReturned));
            return {
              id: item.id,
              productId: item.productId,
              productName: item.product?.name,
              quantityDispatched,
              quantityReturned,
              balanceQuantity,
            };
          }),
        })),
      },
      vendors,
      childComponents,
      generatedAt: new Date().toISOString(),
    };
  }
}

