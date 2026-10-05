export interface ProductionProcessDto {
  id: string;
  sequenceId: string;
  nomenclature: string;
  internalCode: string;
  description: string;
  baseUom: string;
  isActive: boolean;
  expectedCycleTimeMs: number;
  costCenter: string;
  qcCheckpoints: string[];
  linkedVendorIds: string[];
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface CreateProductionProcessDto {
  sequenceId: string;
  nomenclature: string;
  internalCode: string;
  description: string;
  baseUom: string;
  expectedCycleTimeMs: number;
  costCenter: string;
  qcCheckpoints: string[];
  linkedVendorIds: string[];
}

export interface UpdateProductionProcessDto extends Partial<CreateProductionProcessDto> {
  isActive?: boolean;
}

export interface VendorDto {
  id: string;
  vendorName: string;
  code: string;
  isApproved: boolean;
}
