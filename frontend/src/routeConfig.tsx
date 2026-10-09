import { LayoutDashboard, PackageSearch, PackagePlus, BellRing, Box, Shield, Settings, PackageCheck, ShieldCheck, Network, BarChart3, FileText, FilePlus, PlaySquare, Users, Database } from 'lucide-react';
import type { UserRole } from './contexts/AuthContext';

import { MslAlertsWorkspace } from './pages/MslAlertsWorkspace';
import { ProcessMasterWorkspace } from './pages/ProcessMasterWorkspace';
import { VendorSlaWorkspace } from './pages/VendorSlaWorkspace';
import { Type1DispatchWorkspace } from './pages/Type1DispatchWorkspace';
import { Type2DispatchWorkspace } from './pages/Type2DispatchWorkspace';
import { DockReceiptWorkspace } from './pages/DockReceiptWorkspace';
import { TraceabilityWorkspace } from './pages/TraceabilityWorkspace';
import { PoTraceabilityWorkspace } from './pages/PoTraceabilityWorkspace';
import { VendorDashboardWorkspace } from './pages/VendorDashboardWorkspace';
import { DeliveryChallanPrintView } from './pages/DeliveryChallanPrintView';
import { ReportGeneratorWorkspace } from './pages/ReportGeneratorWorkspace';
import { RmRequisitionWorkspace } from './pages/RmRequisitionWorkspace';
import { RmCreationWorkspace } from './pages/RmCreationWorkspace';
import { ProductionConsumptionWorkspace } from './pages/ProductionConsumptionWorkspace';
import { UiKitShowcase } from './pages/UiKitShowcase';
import { OverviewPage } from './pages/OverviewPage';
import { StoresRmIssueWorkspace } from './pages/StoresRmIssueWorkspace';
import { StoresExtraRequestsWorkspace } from './pages/StoresExtraRequestsWorkspace';
import { StoresReturnVerifyWorkspace } from './pages/StoresReturnVerifyWorkspace';
import { SupplierInwardWorkspace } from './pages/SupplierInwardWorkspace';
import { WarehousesAndBinsWorkspace } from './pages/WarehousesAndBinsWorkspace';
import { UserMasterWorkspace } from './pages/UserMasterWorkspace';
import { VendorMasterWorkspace } from './pages/VendorMasterWorkspace';
import { ProductsMasterWorkspace } from './pages/ProductsMasterWorkspace';
import { InventoryStockWorkspace } from './pages/InventoryStockWorkspace';
import { StockMovementWorkspace } from './pages/StockMovementWorkspace';
import type { ElementType } from 'react';
import { ProductionRmWorkspace } from './pages/ProductionRmWorkspace';

export interface RouteConfig {
  name: string;
  path: string;
  icon?: ElementType;
  roles: UserRole[];
  component: ElementType;
  isSidebar: boolean;
  group?: string;
  isPrintable?: boolean;
  moduleKey?: string;
}

export const ROUTE_CONFIG: RouteConfig[] = [
  // EXECUTIVE & OVERVIEW (Top Priority in Navigation)
  { name: 'Overview', path: '/overview', icon: LayoutDashboard, roles: ['DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: OverviewPage, isSidebar: true, group: 'OVERVIEW', moduleKey: 'overview' },

  // RM WORKFLOW
  { name: 'RM Creation', path: '/design/rm-creation', icon: FilePlus, roles: ['PRODUCTION', 'DESIGNER', 'ADMIN'], component: RmCreationWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_creation' },
  { name: 'My Requisitions', path: '/design/my-requisitions', icon: FileText, roles: ['PRODUCTION', 'DESIGNER', 'ADMIN'], component: RmRequisitionWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_requisitions' },
  { name: 'RM Issue', path: '/stores/rm-issue', icon: PackageSearch, roles: ['STORES', 'ADMIN'], component: StoresRmIssueWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_issue' },
  { name: 'Extra Requests', path: '/stores/extra-requests', icon: FilePlus, roles: ['PRODUCTION', 'STORES', 'ADMIN'], component: StoresExtraRequestsWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'extra_requests' },
  { name: 'Return Verify', path: '/stores/return-verify', icon: PackageCheck, roles: ['PRODUCTION', 'STORES', 'ADMIN'], component: StoresReturnVerifyWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'return_verify' },
  { name: 'My RM', path: '/production/rm', icon: PackageSearch, roles: ['PRODUCTION', 'ADMIN'], component: ProductionRmWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'production_rm' },
  { name: 'Consumption', path: '/production/consumption', icon: PlaySquare, roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ProductionConsumptionWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'consumption' },

  // INVENTORY
  { name: 'Stock Overview', path: '/inventory/stock', icon: Box, roles: ['STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'DESIGNER'], component: InventoryStockWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'stock_overview' },
  { name: 'Stock Movement', path: '/inventory/movements', icon: PackageSearch, roles: ['STORES', 'ADMIN'], component: StockMovementWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'stock_movements' },
  { name: 'Supplier Inward (GRN)', path: '/inventory/grn', icon: PackagePlus, roles: ['STORES', 'ADMIN'], component: SupplierInwardWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'supplier_inward' },
  { name: 'MSL Alerts', path: '/inventory/msl-alerts', icon: BellRing, roles: ['STORES', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: MslAlertsWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'msl_alerts' },
  
  // DELIVERY CHALLAN
  { name: 'DC Type 1 (Process)', path: '/dispatch/delivery-challan/type-1', icon: Box, roles: ['STORES', 'ADMIN'], component: Type1DispatchWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_type1' },
  { name: 'DC Type 2 (General)', path: '/dispatch/delivery-challan/type-2', icon: Box, roles: ['STORES', 'ADMIN'], component: Type2DispatchWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_type2' },
  { name: 'DC Returns', path: '/dispatch/returns', icon: PackageCheck, roles: ['STORES', 'ADMIN'], component: DockReceiptWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_returns' },

  // GOVERNANCE
  { name: 'SC Traceability', path: '/governance/traceability', icon: ShieldCheck, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: TraceabilityWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'sc_traceability' },
  { name: 'PO Traceability', path: '/governance/po-traceability', icon: Network, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: PoTraceabilityWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'po_traceability' },
  { name: 'Vendor SLAs', path: '/governance/vendor-slas', icon: Shield, roles: ['SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: VendorSlaWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'vendor_slas' },
  { name: 'Vendor Analytics', path: '/governance/vendor-analytics', icon: BarChart3, roles: ['SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: VendorDashboardWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'vendor_analytics' },
  
  // MASTERS
  { name: 'Users', path: '/masters/users', icon: Users, roles: ['ADMIN'], component: UserMasterWorkspace, isSidebar: true, group: 'MASTERS', moduleKey: 'users_master' },
  { name: 'Products', path: '/masters/products', icon: Database, roles: ['ADMIN'], component: ProductsMasterWorkspace, isSidebar: true, group: 'MASTERS', moduleKey: 'products_master' },
  { name: 'Warehouses and Bins', path: '/masters/bins', icon: Box, roles: ['ADMIN'], component: WarehousesAndBinsWorkspace, isSidebar: true, group: 'MASTERS', moduleKey: 'warehouses_master' },
  { name: 'Vendors', path: '/masters/vendors', icon: Database, roles: ['ADMIN', 'GENERAL_MANAGER'], component: VendorMasterWorkspace, isSidebar: true, group: 'MASTERS', moduleKey: 'vendors_master' },
  { name: 'Process Master', path: '/governance/process-master', icon: Settings, roles: ['ADMIN'], component: ProcessMasterWorkspace, isSidebar: true, group: 'MASTERS', moduleKey: 'process_master' },

  // REPORTS
  { name: 'Enterprise Reports', path: '/reports/generation', icon: FileText, roles: ['SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: ReportGeneratorWorkspace, isSidebar: true, group: 'REPORTS', moduleKey: 'enterprise_reports' },

  // PRINTABLE (Not in Sidebar)
  { name: 'DC Print', path: '/dispatch/delivery-challan/:id/print', roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: DeliveryChallanPrintView, isSidebar: false, isPrintable: true },

  // DEV TOOLS (Hidden from sidebar)
  { name: 'UI Kit Showcase', path: '/dev/ui-kit', icon: FileText, roles: ['ADMIN'], component: UiKitShowcase, isSidebar: false },
];
