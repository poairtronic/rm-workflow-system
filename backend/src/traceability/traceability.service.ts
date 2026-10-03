import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesOrderComponent } from '../sc/entities/sc.entity.js';
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
   * Phase 20.1 — Computes authoritative Final Raw Material (RM) Usage for a Sales Order Component (SC).
   * Aggregates:
   *   - Original RM Requested (from RmItems)
   *   - Initial Material Issued
   *   - Additional Material Issued (Additional Issues + General Issues)
   *   - Production Material Consumed
   *   - Material Returned (Acknowledged by Stores)
   *   - Final RM Used = Original RM + Additional Issued - Returned
   *   - Zero-Loss Verification: Total Issued - Total Consumed - Total Returned == 0 (Variance)
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

      // 2. Additional Issues (from MaterialIssue ADDITIONAL_ISSUE)
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
    // Include any general issue quantities linked to SC into additionalRm
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
}
