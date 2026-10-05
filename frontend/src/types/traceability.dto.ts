export type TraceabilityEventType = 
  | 'ORDER_CREATED' 
  | 'RM_REQUESTED' 
  | 'MATERIAL_ISSUED' 
  | 'DISPATCH_TYPE_1' 
  | 'DC_RETURNED' 
  | 'FINAL_INSPECTION';

export interface TraceabilityEvent {
  id: string;
  type: TraceabilityEventType;
  timestamp: string;
  actor: string;
  title: string;
  details: Record<string, string | number | boolean>;
}

export interface ScMasterData {
  scCode: string;
  poNumber: string;
  customerName: string;
  nomenclature: string;
  drawingNumber: string;
  fulfillmentStatus: 'PENDING' | 'IN_PROGRESS' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED';
}

export interface ReconciliationMetrics {
  totalIssuedKg: number;
  totalConsumedKg: number;
  totalReturnedUsableKg: number;
  totalScrapKg: number;
  varianceKg: number;
  isBalanced: boolean;
}

export interface ConsolidatedTraceabilityDto {
  masterData: ScMasterData;
  events: TraceabilityEvent[];
  reconciliation: ReconciliationMetrics;
}
