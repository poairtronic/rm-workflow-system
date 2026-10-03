export interface MslException {
  sku: string;
  itemName: string;
  category: string;
  currentStock: number;
  mslThreshold: number;
  deficit: number;
  unit: string;
  severity: 'CRITICAL' | 'LOW_STOCK';
}

export const MOCK_MSL_EXCEPTIONS: MslException[] = [
  {
    sku: 'RMR-RAW-015',
    itemName: 'Elastane Spandex Thread',
    category: 'Raw Material',
    currentStock: 0,
    mslThreshold: 50,
    deficit: 50,
    unit: 'KG',
    severity: 'CRITICAL'
  },
  {
    sku: 'RMR-RAW-022',
    itemName: 'Polyurethane Resin Base',
    category: 'Raw Material',
    currentStock: 15,
    mslThreshold: 100,
    deficit: 85,
    unit: 'LTR',
    severity: 'CRITICAL'
  },
  {
    sku: 'RMR-PAC-045',
    itemName: 'Corrugated Carton Type B',
    category: 'Packaging',
    currentStock: 450,
    mslThreshold: 1000,
    deficit: 550,
    unit: 'NOS',
    severity: 'LOW_STOCK'
  },
  {
    sku: 'RMR-SFG-102',
    itemName: 'Aero Seal Ring p20',
    category: 'Semi-Finished',
    currentStock: 12,
    mslThreshold: 50,
    deficit: 38,
    unit: 'NOS',
    severity: 'LOW_STOCK'
  },
  {
    sku: 'RMR-CON-008',
    itemName: 'Machine Lubricant Oil',
    category: 'Consumables',
    currentStock: 2,
    mslThreshold: 5,
    deficit: 3,
    unit: 'LTR',
    severity: 'CRITICAL'
  }
];
