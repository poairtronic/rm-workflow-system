export interface PoScSummary {
  scId: string;
  nomenclature: string;
  quantityOrdered: number;
  quantityCompleted: number;
  status: 'DRAFT' | 'IN_PRODUCTION' | 'CLOSED';
}

export interface PoKpiData {
  totalScs: number;
  overallFulfillmentPercentage: number;
  cumulativeMaterialWeightKg: number;
  activeVendorDispatches: number;
}

export interface PoMaterialChartData {
  materialCategory: string;
  requestedKg: number;
  consumedKg: number;
}

export interface PoStatusDistribution {
  name: string;
  value: number;
  color: string;
}

export interface PoDcLog {
  dcNumber: string;
  scReference: string;
  vendorName: string;
  dispatchDate: string;
  expectedReturnDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PARTIAL_RETURN' | 'CLOSED';
}

export interface PoConsolidatedTraceabilityDto {
  poNumber: string;
  poDate: string;
  customerName: string;
  targetDeliveryDate: string;
  kpis: PoKpiData;
  scs: PoScSummary[];
  materialChartData: PoMaterialChartData[];
  statusDistribution: PoStatusDistribution[];
  dcLogs: PoDcLog[];
}
