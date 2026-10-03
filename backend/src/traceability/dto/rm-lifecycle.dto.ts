import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { ScStatus } from '../../sc/entities/sc.entity.js';

export enum RmLifecycleCategory {
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
}

export enum ReconciliationReason {
  ALL = 'ALL',
  PENDING_STORE_ACK_RETURN = 'PENDING_STORE_ACK_RETURN',
  VARIANCE_DISCREPANCY = 'VARIANCE_DISCREPANCY',
  AWAITING_FINAL_CLOSURE = 'AWAITING_FINAL_CLOSURE',
}

export class RmLifecycleFilterDto extends PaginationDto {
  @IsOptional()
  @IsEnum(RmLifecycleCategory)
  category?: RmLifecycleCategory;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RmLifecycleItemDto {
  scId!: string;
  scNumber!: string;
  poId!: string;
  poNumber?: string;
  customerName?: string;
  productName!: string;
  drawingNumber?: string;
  targetQuantity!: number;
  scStatus!: ScStatus;
  lifecycleCategory!: RmLifecycleCategory;
  originalRm!: number;
  totalIssued!: number;
  totalConsumed!: number;
  totalReturned!: number;
  pendingReturn!: number;
  outstandingQuantity!: number;
  variance!: number;
  isZeroLossVerified!: boolean;
  isPendingReconciliation!: boolean;
  createdAt!: string;
  completedAt?: string;
}

export class RmLifecycleCountsDto {
  totalSc!: number;
  openRmCount!: number;
  completedRmCount!: number;
  closedRmCount!: number;
  pendingReconciliationCount!: number;
}

export class RmLifecycleTotalsDto {
  totalOriginalRm!: number;
  totalIssued!: number;
  totalConsumed!: number;
  totalReturned!: number;
  totalPendingReturn!: number;
  totalOutstanding!: number;
}

export class RmLifecycleSummaryResponseDto {
  counts!: RmLifecycleCountsDto;
  totals!: RmLifecycleTotalsDto;
  data!: RmLifecycleItemDto[];
  pagination!: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class RmReconciliationQueueFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(ReconciliationReason)
  reason?: ReconciliationReason;
}

export class PendingReturnDetailDto {
  returnId!: string;
  quantity!: number;
  returnedAt!: string;
  returnedBy?: string;
  remarks?: string;
}

export class RmReconciliationQueueItemDto {
  scId!: string;
  scNumber!: string;
  poId!: string;
  poNumber?: string;
  customerName?: string;
  productName!: string;
  scStatus!: ScStatus;
  lifecycleCategory!: RmLifecycleCategory;
  originalRm!: number;
  totalIssued!: number;
  totalConsumed!: number;
  totalReturned!: number;
  pendingReturn!: number;
  outstandingQuantity!: number;
  variance!: number;
  reconciliationReasons!: string[];
  pendingReturns!: PendingReturnDetailDto[];
  completedAt?: string;
  createdAt!: string;
}

export class RmReconciliationQueueResponseDto {
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
  items!: RmReconciliationQueueItemDto[];
}
