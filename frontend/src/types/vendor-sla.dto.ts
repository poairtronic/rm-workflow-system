export interface VendorSlaDto {
  id: string;
  vendorName: string;
  vendorId: string;
  processName: string;
  processId: string;
  standardTatDays: number;
  leadTimeMultiplier?: number;
  toleranceBufferDays?: number;
  isActive: boolean;
  alert24h?: boolean;
  alert48h?: boolean;
  alert72h?: boolean;
  emailAlertsEnabled?: boolean;
  smsAlertsEnabled?: boolean;
  complianceScore?: number;
}

export interface CreateVendorSlaDto {
  vendorId: string;
  processId: string;
  standardTatDays: number;
  leadTimeMultiplier?: number;
  toleranceBufferDays?: number;
  alert24h?: boolean;
  alert48h?: boolean;
  alert72h?: boolean;
  emailAlertsEnabled?: boolean;
  smsAlertsEnabled?: boolean;
}

export interface SlaOverrideDto {
  dcId?: string;
  newTargetDate: string; // ISO Date String
  justificationCode: string;
  justificationNotes: string;
  originalTargetDate?: string;
}

export interface ComplianceDataPoint {
  month: string;
  agreedTat: number;
  actualDelivery: number;
}

export interface VendorComplianceResult {
  vendorId: string;
  vendorName: string;
  overallScore: number;
  totalCompletedJobs: number;
  onTimeJobs: number;
  monthlyTrend: ComplianceDataPoint[];
}

export interface VendorComparisonResult {
  vendorId: string;
  vendorName: string;
  vendorCode?: string;
  isActive: boolean;
  processId: string;
  processName: string;
  agreedSlaDays: number;
  toleranceBufferDays: number;
  actualAvgTatDays: number;
  onTimeDeliveryRate: number;
  activeCustodyDcs: number;
  totalCompletedJobs: number;
  isFastest: boolean;
  isMostReliable: boolean;
  isLowestLoad: boolean;
}

export interface VendorSlaOverrideItem {
  id: string;
  slaId: string;
  dcId?: string | null;
  authorizedById: string;
  authorizedBy?: {
    id: string;
    name: string;
    email: string;
  };
  originalTargetDate?: string | null;
  newTargetDate: string;
  justificationCode: string;
  justificationNotes: string;
  createdAt: string;
}
