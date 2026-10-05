export interface VendorSlaDto {
  id: string;
  vendorName: string;
  vendorId: string;
  processName: string;
  processId: string;
  standardTatDays: number;
  leadTimeMultiplier: number;
  toleranceBufferDays: number;
  isActive: boolean;
  alert24h: boolean;
  alert48h: boolean;
  alert72h: boolean;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
  complianceScore: number; // e.g., 94.5
}

export interface CreateVendorSlaDto {
  vendorId: string;
  processId: string;
  standardTatDays: number;
  leadTimeMultiplier: number;
  toleranceBufferDays: number;
  alert24h: boolean;
  alert48h: boolean;
  alert72h: boolean;
  emailAlertsEnabled: boolean;
  smsAlertsEnabled: boolean;
}

export interface SlaOverrideDto {
  newTargetDate: string; // ISO Date String
  justificationCode: string;
  justificationNotes: string;
}

export interface ComplianceDataPoint {
  month: string;
  agreedTat: number;
  actualDelivery: number;
}
