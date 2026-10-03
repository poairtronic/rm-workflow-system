import type { SeverityLevel } from '../components/dashboard/DeficitProgressBar';

export interface MslExceptionRow {
  id: string;
  materialCode: string;
  description: string;
  mslTarget: number;
  currentStock: number;
  unit: string;
  severity: SeverityLevel;
  lastUpdated: string;
}
