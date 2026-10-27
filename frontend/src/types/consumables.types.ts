export type ConsumablePaymentMode = 'CASH' | 'CREDIT';

export type ConsumableItemTrack = 'STOCK_ITEM' | 'NON_STOCK_OR_NEW';

export type ConsumableItemStatus =
  | 'READY_FOR_ISSUE'
  | 'OPEN'
  | 'PURCHASE_REQUESTED'
  | 'PURCHASE_RECEIVED'
  | 'PARTIALLY_ISSUED'
  | 'ISSUED_TO_PRODUCTION'
  | 'RECEIVED_BY_PRODUCTION';

export interface ProductCatalogItem {
  id: string;
  name: string;
  code?: string;
  uom?: string;
  availableStock: number;
  category?: string;
}

export interface VendorOption {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
}

export const STANDARD_CONSUMABLE_ITEMS: string[] = [
  'Gloves',
  'Drill Bit',
  'Safety Gloves',
  'Ear Plugs',
  'Brush',
  'Hacksaw Blade',
  'Cutting Wheel',
  'File',
  'Grinding Wheel',
  'Dressing Tool',
  'Insert',
  'Tap set',
  'Machine oil',
  'Hydralic oil',
  'Rust Oil',
  'Coolant Oil',
  'Ejector Pin',
  'Spray Paint',
  'IP',
  'Thinner',
  'M seal',
  'Locktite 641',
  'Anabond',
  'Grub Screw',
  'Allen Screw',
  'Waist Cloth',
  'Emery Wheel',
  'Emery Sheet',
  'Brass rod',
  'Centre Bit',
  'Carbide End mill',
  'Reamer',
  'Belt',
  'Blue Tube',
];

export interface ConsumableItemDraft {
  tempId: string;
  isNewProduct: boolean;
  productId?: string;
  productCode?: string;
  baseProductName?: string;
  specification?: string;
  description: string;
  uom: string;
  requestedQty: number;
  stockAvailableAtRequest: number;
  // Vendor Context
  vendorId?: string;
  vendorName?: string;
  unitPrice?: number;
  isNewVendor: boolean;
  newVendorName?: string;
  newVendorAddress?: string;
  newVendorMobile?: string;
  newVendorPrice?: number;
}

export interface CreateConsumableRequestPayload {
  paymentMode: ConsumablePaymentMode;
  endUserInVelan: string;
  requestedBy: string;
  preparedBy?: string;
  verifiedBy?: string;
  approvedBy?: string;
  remarks?: string;
  items: Array<{
    isNewProduct: boolean;
    productId?: string;
    productCode?: string;
    description: string;
    uom: string;
    requestedQty: number;
    stockAvailableAtRequest?: number;
    vendorId?: string;
    vendorName?: string;
    unitPrice?: number;
    isNewVendor?: boolean;
    newVendorName?: string;
    newVendorAddress?: string;
    newVendorMobile?: string;
    newVendorPrice?: number;
  }>;
}

export interface ConsumableLineItemRecord {
  id: string;
  requestId: string;
  requestCode: string;
  prNumber?: string | null;
  productId: string;
  productCode?: string | null;
  description: string;
  uom: string;
  isNewProduct: boolean;
  itemCategoryTrack: ConsumableItemTrack;
  stockAvailableAtRequest: number;
  requestedQty: number;
  purchaseQty?: number | null;
  realReceivedQty: number;
  issuedQty: number;
  vendorId?: string | null;
  vendorName?: string | null;
  unitPrice?: number | null;
  isNewVendor: boolean;
  newVendorName?: string | null;
  newVendorAddress?: string | null;
  newVendorMobile?: string | null;
  newVendorPrice?: number | null;
  endUserInVelan?: string | null;
  requestedBy?: string | null;
  binId?: string | null;
  binCode?: string | null;
  status: ConsumableItemStatus;
  printedAt?: string | null;
  purchaseReceivedAt?: string | null;
  issuedAt?: string | null;
  productionReceivedAt?: string | null;
  productionReceivedById?: string | null;
  createdAt: string;
  updatedAt: string;
}
