export interface VendorMasterDto {
  id: string;
  code: string;
  name: string;
  category?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVendorMasterDto {
  code: string;
  name: string;
  category?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  notes?: string;
}

export interface UpdateVendorMasterDto {
  code?: string;
  name?: string;
  category?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
  notes?: string;
}

