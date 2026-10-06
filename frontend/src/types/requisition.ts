export type RequisitionStatus = 'PENDING' | 'APPROVED';

export interface MaterialRequisition {
  id: string;
  scCode: string;
  materialSpec: string;
  quantity: number;
  unit: string;
  targetTime: string;
  status: RequisitionStatus;
}


