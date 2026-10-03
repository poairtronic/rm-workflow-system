export interface BinTelemetry {
  binId: string;
  materialSpec: string;
  stockOnHand: number;
  allocated: number;
  freeBalance: number;
  capacity: number;
  isLocked: boolean;
}

export const mockBins: BinTelemetry[] = [
  {
    binId: 'BIN-B2-01',
    materialSpec: 'EN31 High Carbon',
    stockOnHand: 450.0,
    allocated: 120.0,
    freeBalance: 330.0,
    capacity: 1000.0,
    isLocked: true,
  },
  {
    binId: 'BIN-B2-02',
    materialSpec: 'EN31 High Carbon',
    stockOnHand: 850.5,
    allocated: 50.0,
    freeBalance: 800.5,
    capacity: 1000.0,
    isLocked: false,
  },
  {
    binId: 'BIN-C1-04',
    materialSpec: 'Al 6061 Forged',
    stockOnHand: 200.0,
    allocated: 0.0,
    freeBalance: 200.0,
    capacity: 500.0,
    isLocked: false,
  },
];
