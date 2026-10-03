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

export const mockRequisitions: MaterialRequisition[] = [
  {
    id: 'REQ-2026-0881',
    scCode: 'SC-001',
    materialSpec: 'EN31 High Carbon',
    quantity: 82.3,
    unit: 'KG',
    targetTime: '14:30 IST',
    status: 'APPROVED',
  },
  {
    id: 'REQ-2026-0882',
    scCode: 'SC-002',
    materialSpec: 'Al 6061 Forged',
    quantity: 120.0,
    unit: 'KG',
    targetTime: '15:15 IST',
    status: 'PENDING',
  },
  {
    id: 'REQ-2026-0883',
    scCode: 'SC-003',
    materialSpec: 'SS316L Round Bar',
    quantity: 45.5,
    unit: 'KG',
    targetTime: '16:00 IST',
    status: 'APPROVED',
  },
  {
    id: 'REQ-2026-0884',
    scCode: 'SC-004',
    materialSpec: 'EN8D Hexagonal',
    quantity: 320.0,
    unit: 'KG',
    targetTime: '09:00 IST',
    status: 'PENDING',
  },
  {
    id: 'REQ-2026-0885',
    scCode: 'SC-005',
    materialSpec: 'OHNS Flat Bar',
    quantity: 15.2,
    unit: 'KG',
    targetTime: '10:45 IST',
    status: 'APPROVED',
  },
];
