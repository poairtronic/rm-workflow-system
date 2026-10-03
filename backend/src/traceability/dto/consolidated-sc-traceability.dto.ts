import { ScStatus } from '../../sc/entities/sc.entity.js';
import { FormType, RmRequestStatus } from '../../rm/entities/rm-request.entity.js';
import { MaterialIssueType } from '../../material-issue/entities/material-issue.entity.js';
import { ReceiptStatus } from '../../production/entities/production-receipt.entity.js';
import { ReturnStatus } from '../../production/entities/material-return.entity.js';
import {
  AdditionalRequestStatus,
  AdditionalReason,
} from '../../additional-request/entities/additional-request.entity.js';
import { TransactionType } from '../../inventory/entities/stock-transaction.entity.js';
import {
  FinalRmUsageSummary,
  RmUsageItemBreakdown,
} from './final-rm-usage.dto.js';

export class ConsolidatedScMetaDto {
  id!: string;
  scNumber!: string;
  productName!: string;
  drawingNumber?: string;
  description?: string;
  targetQuantity!: number;
  status!: ScStatus;
  createdAt!: string;
  updatedAt!: string;
  completedAt?: string;
  completedBy?: {
    id: string;
    name: string;
    email: string;
  };
  completionRemarks?: string;
}

export class ConsolidatedCustomerDto {
  id!: string;
  code!: string;
  name!: string;
  email?: string;
  phone?: string;
}

export class ConsolidatedPoDto {
  id!: string;
  poNumber!: string;
  externalReference?: string;
  referenceDate?: string;
  remarks?: string;
  customer?: ConsolidatedCustomerDto;
}

export class ConsolidatedRmItemDto {
  id!: string;
  material!: string;
  materialType!: string;
  grade?: string;
  size?: string;
  quantity!: number;
  weightUnit!: string;
  remarks?: string;
}

export class ConsolidatedRmRequestDto {
  id!: string;
  formType!: FormType;
  status!: RmRequestStatus;
  revisionNumber!: number;
  submittedAt?: string;
  reviewedAt?: string;
  completedAt?: string;
  createdBy?: {
    id: string;
    name: string;
  };
  reviewedBy?: {
    id: string;
    name: string;
  };
  items!: ConsolidatedRmItemDto[];
}

export class ConsolidatedIssueItemDto {
  id!: string;
  rmItemId!: string;
  quantityIssued!: number;
  remarks?: string;
}

export class ConsolidatedIssueDto {
  id!: string;
  issueNumber!: string;
  issueType!: MaterialIssueType;
  issueDate!: string;
  issuedBy?: {
    id: string;
    name: string;
  };
  remarks?: string;
  items!: ConsolidatedIssueItemDto[];
}

export class ConsolidatedReceiptItemDto {
  id!: string;
  rmItemId!: string;
  quantityReceived!: number;
  remarks?: string;
}

export class ConsolidatedReceiptDto {
  id!: string;
  materialIssueId!: string;
  status!: ReceiptStatus;
  receivedAt!: string;
  receivedBy?: {
    id: string;
    name: string;
  };
  remarks?: string;
  items!: ConsolidatedReceiptItemDto[];
}

export class ConsolidatedConsumptionDto {
  id!: string;
  rmItemId!: string;
  consumedQuantity!: number;
  unit!: string;
  recordedAt!: string;
  recordedBy?: {
    id: string;
    name: string;
  };
  remarks?: string;
}

export class ConsolidatedReturnItemDto {
  id!: string;
  rmItemId!: string;
  quantityReturned!: number;
  remarks?: string;
}

export class ConsolidatedReturnDto {
  id!: string;
  status!: ReturnStatus;
  returnedAt!: string;
  returnedBy?: {
    id: string;
    name: string;
  };
  confirmedAt?: string;
  confirmedBy?: {
    id: string;
    name: string;
  };
  remarks?: string;
  items!: ConsolidatedReturnItemDto[];
}

export class ConsolidatedAdditionalRequestItemDto {
  id!: string;
  rmItemId!: string;
  requestedQuantity!: number;
  approvedQuantity?: number;
  remarks?: string;
}

export class ConsolidatedAdditionalRequestDto {
  id!: string;
  status!: AdditionalRequestStatus;
  reason!: AdditionalReason;
  requestedAt!: string;
  requestedBy?: {
    id: string;
    name: string;
  };
  approvedAt?: string;
  approvedBy?: {
    id: string;
    name: string;
  };
  remarks?: string;
  items!: ConsolidatedAdditionalRequestItemDto[];
}

export class ConsolidatedInventoryTransactionDto {
  id!: string;
  transactionType!: TransactionType;
  quantity!: number;
  referenceType!: string;
  referenceId?: string;
  createdAt!: string;
  createdBy?: {
    id: string;
    name: string;
  };
  product?: {
    id: string;
    name: string;
  };
  remarks?: string;
}

export class ConsolidatedProcessStepDto {
  processId!: string;
  name!: string;
  code!: string;
  sequenceNumber!: number;
  allowsOutsideVendor!: boolean;
  status!: string;
  deliveryChallanCount!: number;
  vendorNames!: string[];
}

export class ConsolidatedDeliveryChallanItemDto {
  id!: string;
  productId?: string;
  productName?: string;
  quantityDispatched!: number;
  quantityReturned!: number;
  balanceQuantity!: number;
}

export class ConsolidatedDeliveryChallanDto {
  id!: string;
  challanNumber!: string;
  type!: string;
  status!: string;
  dispatchDate!: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  vendor?: {
    id: string;
    name: string;
    code: string;
  };
  process?: {
    id: string;
    name: string;
    code: string;
  };
  items!: ConsolidatedDeliveryChallanItemDto[];
}

export class ConsolidatedVendorDto {
  id!: string;
  name!: string;
  code!: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  totalChallans!: number;
  activeChallans!: number;
}

export class ConsolidatedFinalRmUsageDto {
  summary!: FinalRmUsageSummary;
  items!: RmUsageItemBreakdown[];
}

export class ConsolidatedScTraceabilityDto {
  sc!: ConsolidatedScMetaDto;
  po!: ConsolidatedPoDto;
  rmRequests!: ConsolidatedRmRequestDto[];
  issues!: ConsolidatedIssueDto[];
  receipts!: ConsolidatedReceiptDto[];
  consumption!: ConsolidatedConsumptionDto[];
  returns!: ConsolidatedReturnDto[];
  additionalMaterial!: ConsolidatedAdditionalRequestDto[];
  inventoryTransactions!: ConsolidatedInventoryTransactionDto[];
  productionProcesses!: ConsolidatedProcessStepDto[];
  deliveryChallans!: ConsolidatedDeliveryChallanDto[];
  vendors!: ConsolidatedVendorDto[];
  finalRmUsage!: ConsolidatedFinalRmUsageDto;
  generatedAt!: string;
}
