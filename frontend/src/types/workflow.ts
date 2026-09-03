export type WorkflowStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'STORES_PENDING'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED'
  | 'RECEIVED'
  | 'IN_PRODUCTION'
  | 'ADDITIONAL_REQUEST'
  | 'COMPLETED';

export interface RawMaterialItem {
  id: string;
  materialName: string;
  grade: string;
  size: string;
  requiredQty: number;
  issuedQty: number;
  receivedQty: number;
  consumedQty: number;
  returnedQty: number;
  unit: string;
  status: 'PENDING' | 'AVAILABLE' | 'PARTIALLY_ISSUED' | 'ISSUED' | 'CONSUMED';
  remarks?: string;
}

export interface SalesOrderComponent {
  scNumber: string;
  poNumber: string;
  customerName: string;
  productName: string;
  status: WorkflowStatus;
  materials: RawMaterialItem[];
  createdAt: string;
  updatedAt: string;
}
