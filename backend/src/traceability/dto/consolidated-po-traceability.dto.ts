import { ScStatus } from '../../sc/entities/sc.entity.js';
import { RmLifecycleCategory } from './rm-lifecycle.dto.js';
import { FinalRmUsageSummary } from './final-rm-usage.dto.js';
import {
  ConsolidatedCustomerDto,
  ConsolidatedInventoryTransactionDto,
  ConsolidatedProcessStepDto,
  ConsolidatedDeliveryChallanDto,
  ConsolidatedVendorDto,
} from './consolidated-sc-traceability.dto.js';

export class PoTraceabilityMetaDto {
  id!: string;
  poNumber!: string;
  externalReference?: string;
  referenceDate?: string;
  remarks?: string;
  customer?: ConsolidatedCustomerDto;
  createdAt!: string;
  updatedAt!: string;
}

export class PoTraceabilitySummaryDto {
  totalScCount!: number;
  openScCount!: number;
  completedScCount!: number;
  closedScCount!: number;
  totalTargetQuantity!: number;
  completedTargetQuantity!: number;
  overallFulfillmentPercentage!: number;
}

export class PoRmSummaryDto {
  totalOriginalRm!: number;
  totalInitialIssued!: number;
  totalAdditionalIssued!: number;
  totalIssued!: number;
  totalConsumed!: number;
  totalReturned!: number;
  totalPendingReturn!: number;
  totalOutstanding!: number;
  totalFinalRmUsed!: number;
  totalVariance!: number;
  isAllZeroLossVerified!: boolean;
}

export class PoInventorySummaryDto {
  totalTransactions!: number;
  totalStockOut!: number;
  totalStockIn!: number;
  transactions!: ConsolidatedInventoryTransactionDto[];
}

export class PoProductionStatusDto {
  totalTargetQuantity!: number;
  completedTargetQuantity!: number;
  statusBreakdown!: Record<string, number>;
  activeProcesses!: ConsolidatedProcessStepDto[];
}

export class PoDeliveryChallanSummaryDto {
  totalChallans!: number;
  dispatchedChallans!: number;
  closedChallans!: number;
  items!: ConsolidatedDeliveryChallanDto[];
}

export class PoChildComponentNodeDto {
  scId!: string;
  scNumber!: string;
  productName!: string;
  drawingNumber?: string;
  targetQuantity!: number;
  status!: ScStatus;
  lifecycleCategory!: RmLifecycleCategory;
  rmSummary!: FinalRmUsageSummary;
  deliveryChallanCount!: number;
  vendorNames!: string[];
  isZeroLossVerified!: boolean;
  isPendingReconciliation!: boolean;
  createdAt!: string;
  completedAt?: string;
}

export class ConsolidatedPoTraceabilityDto {
  po!: PoTraceabilityMetaDto;
  summary!: PoTraceabilitySummaryDto;
  rmSummary!: PoRmSummaryDto;
  inventorySummary!: PoInventorySummaryDto;
  productionStatus!: PoProductionStatusDto;
  deliveryChallans!: PoDeliveryChallanSummaryDto;
  vendors!: ConsolidatedVendorDto[];
  childComponents!: PoChildComponentNodeDto[];
  generatedAt!: string;
}
