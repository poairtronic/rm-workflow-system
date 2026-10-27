import { lazy, type ElementType } from 'react';
import {
  LayoutDashboard,
  PackageSearch,
  PackagePlus,
  BellRing,
  Box,
  Shield,
  Settings,
  PackageCheck,
  ShieldCheck,
  Network,
  BarChart3,
  FileText,
  FilePlus,
  Users,
  Database,
  Truck,
  Mail,
  User,
  PlaySquare,
  ShoppingCart,
  ClipboardList,
  Wrench,
} from 'lucide-react';
import type { UserRole } from './contexts/AuthContext';

// Dynamic Lazy Imports for Workspace Routes (Prompt 4.1 / Phase 24A)
export const SystemConfigurationWorkspace = lazy(() =>
  import('./pages/SystemConfigurationWorkspace').then((m) => ({ default: m.SystemConfigurationWorkspace })),
);
export const ProfileWorkspace = lazy(() =>
  import('./pages/ProfileWorkspace').then((m) => ({ default: m.ProfileWorkspace })),
);
export const AuditLogsWorkspace = lazy(() =>
  import('./pages/AuditLogsWorkspace').then((m) => ({ default: m.AuditLogsWorkspace })),
);
export const EmailCommunicationWorkspace = lazy(() =>
  import('./pages/EmailCommunicationWorkspace').then((m) => ({ default: m.EmailCommunicationWorkspace })),
);
export const MslAlertsWorkspace = lazy(() =>
  import('./pages/MslAlertsWorkspace').then((m) => ({ default: m.MslAlertsWorkspace })),
);
export const ProcessMasterWorkspace = lazy(() =>
  import('./pages/ProcessMasterWorkspace').then((m) => ({ default: m.ProcessMasterWorkspace })),
);
export const VendorSlaWorkspace = lazy(() =>
  import('./pages/VendorSlaWorkspace').then((m) => ({ default: m.VendorSlaWorkspace })),
);
export const Type1DispatchWorkspace = lazy(() =>
  import('./pages/Type1DispatchWorkspace').then((m) => ({ default: m.Type1DispatchWorkspace })),
);
export const Type2DispatchWorkspace = lazy(() =>
  import('./pages/Type2DispatchWorkspace').then((m) => ({ default: m.Type2DispatchWorkspace })),
);
export const DockReceiptWorkspace = lazy(() =>
  import('./pages/DockReceiptWorkspace').then((m) => ({ default: m.DockReceiptWorkspace })),
);
export const DcMovementsWorkspace = lazy(() =>
  import('./pages/DcMovementsWorkspace').then((m) => ({ default: m.DcMovementsWorkspace })),
);
export const TraceabilityWorkspace = lazy(() =>
  import('./pages/TraceabilityWorkspace').then((m) => ({ default: m.TraceabilityWorkspace })),
);
export const ReworkWorkspace = lazy(() =>
  import('./pages/ReworkWorkspace').then((m) => ({ default: m.ReworkWorkspace })),
);
export const PoTraceabilityWorkspace = lazy(() =>
  import('./pages/PoTraceabilityWorkspace').then((m) => ({ default: m.PoTraceabilityWorkspace })),
);
export const VendorDashboardWorkspace = lazy(() =>
  import('./pages/VendorDashboardWorkspace').then((m) => ({ default: m.VendorDashboardWorkspace })),
);
export const DeliveryChallanPrintView = lazy(() =>
  import('./pages/DeliveryChallanPrintView').then((m) => ({ default: m.DeliveryChallanPrintView })),
);
export const ReportGeneratorWorkspace = lazy(() =>
  import('./pages/ReportGeneratorWorkspace').then((m) => ({ default: m.ReportGeneratorWorkspace })),
);
export const RmRequisitionWorkspace = lazy(() =>
  import('./pages/RmRequisitionWorkspace').then((m) => ({ default: m.RmRequisitionWorkspace })),
);
export const RmCreationWorkspace = lazy(() =>
  import('./pages/RmCreationWorkspace').then((m) => ({ default: m.RmCreationWorkspace })),
);
export const ProductionConsumptionWorkspace = lazy(() =>
  import('./pages/ProductionConsumptionWorkspace').then((m) => ({ default: m.ProductionConsumptionWorkspace })),
);
export const UiKitShowcase = lazy(() =>
  import('./pages/UiKitShowcase').then((m) => ({ default: m.UiKitShowcase })),
);
export const OverviewPage = lazy(() =>
  import('./pages/OverviewPage').then((m) => ({ default: m.OverviewPage })),
);
export const StoresRmIssueWorkspace = lazy(() =>
  import('./pages/StoresRmIssueWorkspace').then((m) => ({ default: m.StoresRmIssueWorkspace })),
);
export const SupplierInwardWorkspace = lazy(() =>
  import('./pages/SupplierInwardWorkspace').then((m) => ({ default: m.SupplierInwardWorkspace })),
);
export const WarehousesAndBinsWorkspace = lazy(() =>
  import('./pages/WarehousesAndBinsWorkspace').then((m) => ({ default: m.WarehousesAndBinsWorkspace })),
);
export const UserMasterWorkspace = lazy(() =>
  import('./pages/UserMasterWorkspace').then((m) => ({ default: m.UserMasterWorkspace })),
);
export const VendorMasterWorkspace = lazy(() =>
  import('./pages/VendorMasterWorkspace').then((m) => ({ default: m.VendorMasterWorkspace })),
);
export const ProductsMasterWorkspace = lazy(() =>
  import('./pages/ProductsMasterWorkspace').then((m) => ({ default: m.ProductsMasterWorkspace })),
);
export const InventoryStockWorkspace = lazy(() =>
  import('./pages/InventoryStockWorkspace').then((m) => ({ default: m.InventoryStockWorkspace })),
);
export const StockMovementWorkspace = lazy(() =>
  import('./pages/StockMovementWorkspace').then((m) => ({ default: m.StockMovementWorkspace })),
);
export const ProductionRequestReturnWorkspace = lazy(() =>
  import('./pages/ProductionRequestReturnWorkspace').then((m) => ({ default: m.ProductionRequestReturnWorkspace })),
);
export const StoresRequestReturnVerifyWorkspace = lazy(() =>
  import('./pages/StoresRequestReturnVerifyWorkspace').then((m) => ({ default: m.StoresRequestReturnVerifyWorkspace })),
);
export const ProductionRmVerifyWorkspace = lazy(() =>
  import('./pages/ProductionRmVerifyWorkspace').then((m) => ({ default: m.ProductionRmVerifyWorkspace })),
);
export const ConsumableRequestsWorkspace = lazy(() =>
  import('./pages/ConsumableRequestsWorkspace').then((m) => ({ default: m.ConsumableRequestsWorkspace })),
);
export const ConsumablePurchaseStoreWorkspace = lazy(() =>
  import('./pages/ConsumablePurchaseStoreWorkspace').then((m) => ({ default: m.ConsumablePurchaseStoreWorkspace })),
);

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

  // RM WORKFLOW - DESIGNER & STORES
  { name: 'RM Creation', path: '/design/rm-creation', icon: FilePlus, roles: ['DESIGNER', 'ADMIN'], component: RmCreationWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_creation' },
  { name: 'My Requisitions', path: '/design/my-requisitions', icon: FileText, roles: ['DESIGNER', 'ADMIN'], component: RmRequisitionWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_requisitions' },
  { name: 'RM Issue', path: '/stores/rm-issue', icon: PackageSearch, roles: ['STORES', 'ADMIN'], component: StoresRmIssueWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'rm_issue' },
  { name: 'RM Request & Return Verify', path: '/stores/request-return-verify', icon: ShieldCheck, roles: ['STORES', 'PRODUCTION', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: StoresRequestReturnVerifyWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'request_return_verify' },

  // RM WORKFLOW - PRODUCTION & GOVERNANCE
  { name: 'RM Receipt', path: '/production/rm-receipt', icon: PackageCheck, roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ProductionRmVerifyWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'production_rm_verify' },
  { name: 'RM Request & Return', path: '/production/request-return', icon: PackagePlus, roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ProductionRequestReturnWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'production_request_return' },
  { name: 'Material Consumption', path: '/production/consumption', icon: PlaySquare, roles: ['ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'PRODUCTION', 'STORES'], component: ProductionConsumptionWorkspace, isSidebar: true, group: 'RM WORKFLOW', moduleKey: 'consumption' },

  // BACKWARDS-COMPATIBLE ALIASES FOR LEGACY ROUTES (hidden from sidebar)
  { name: 'Extra Requests (Legacy)', path: '/stores/extra-requests', roles: ['STORES', 'ADMIN'], component: StoresRequestReturnVerifyWorkspace, isSidebar: false },
  { name: 'Return Verify (Legacy)', path: '/stores/return-verify', roles: ['STORES', 'ADMIN'], component: StoresRequestReturnVerifyWorkspace, isSidebar: false },
  { name: 'RM Receive & Verify (Legacy)', path: '/production/rm-verify', roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ProductionRmVerifyWorkspace, isSidebar: false },
  { name: 'Stores RM Receipt (Legacy)', path: '/stores/rm-receipt', roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ProductionRmVerifyWorkspace, isSidebar: false },
  { name: 'My RM (Legacy)', path: '/production/rm', roles: ['PRODUCTION', 'STORES', 'ADMIN'], component: ProductionRmVerifyWorkspace, isSidebar: false },

  // INVENTORY
  { name: 'Stock Overview', path: '/inventory/stock', icon: Box, roles: ['STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'DESIGNER'], component: InventoryStockWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'stock_overview' },
  { name: 'Stock Movement', path: '/inventory/movements', icon: PackageSearch, roles: ['STORES', 'ADMIN'], component: StockMovementWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'stock_movements' },
  { name: 'Supplier Inward (GRN)', path: '/inventory/grn', icon: PackagePlus, roles: ['STORES', 'ADMIN'], component: SupplierInwardWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'supplier_inward' },
  { name: 'MSL Alerts', path: '/inventory/msl-alerts', icon: BellRing, roles: ['STORES', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: MslAlertsWorkspace, isSidebar: true, group: 'INVENTORY', moduleKey: 'msl_alerts' },
  
  // CONSUMABLES
  { name: 'Consumable Requests', path: '/consumables/requests', icon: ShoppingCart, roles: ['PRODUCTION', 'STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'DESIGNER'], component: ConsumableRequestsWorkspace, isSidebar: true, group: 'CONSUMABLES', moduleKey: 'consumables_requests' },
  { name: 'Purchase & Store Consumables', path: '/consumables/purchase-store', icon: ClipboardList, roles: ['STORES', 'ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ConsumablePurchaseStoreWorkspace, isSidebar: true, group: 'CONSUMABLES', moduleKey: 'consumables_purchase_store' },

  // DELIVERY CHALLAN
  { name: 'DC Type 1 (Process)', path: '/dispatch/delivery-challan/type-1', icon: Box, roles: ['STORES', 'ADMIN'], component: Type1DispatchWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_type1' },
  { name: 'DC Type 2 (General)', path: '/dispatch/delivery-challan/type-2', icon: Box, roles: ['STORES', 'ADMIN'], component: Type2DispatchWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_type2' },
  { name: 'DC Returns', path: '/dispatch/returns', icon: PackageCheck, roles: ['STORES', 'ADMIN'], component: DockReceiptWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_returns' },
  { name: 'DC Movements', path: '/dispatch/movements', icon: Truck, roles: ['STORES', 'ADMIN', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: DcMovementsWorkspace, isSidebar: true, group: 'DELIVERY CHALLAN', moduleKey: 'dc_movements' },

  // GOVERNANCE
  { name: 'SC Traceability', path: '/governance/traceability', icon: ShieldCheck, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: TraceabilityWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'sc_traceability' },
  { name: 'Rework', path: '/governance/rework', icon: Wrench, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: ReworkWorkspace, isSidebar: true, group: 'GOVERNANCE', moduleKey: 'rework_qc' },
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

  // SYSTEM SETTINGS
  { name: 'System Configuration', path: '/settings', icon: Settings, roles: ['ADMIN', 'GENERAL_MANAGER'], component: SystemConfigurationWorkspace, isSidebar: true, group: 'SYSTEM SETTINGS', moduleKey: 'system_config' },
  { name: 'Edit Profile', path: '/profile', icon: User, roles: ['DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: ProfileWorkspace, isSidebar: true, group: 'SYSTEM SETTINGS', moduleKey: 'profile' },
  { name: 'Audit Logs', path: '/audit-logs', icon: FileText, roles: ['ADMIN', 'GENERAL_MANAGER', 'SENIOR_MANAGER', 'STORES', 'PRODUCTION', 'DESIGNER'], component: AuditLogsWorkspace, isSidebar: true, group: 'SYSTEM SETTINGS', moduleKey: 'audit_logs' },
  { name: 'Email & Communication', path: '/communication', icon: Mail, roles: ['ADMIN', 'GENERAL_MANAGER', 'SENIOR_MANAGER'], component: EmailCommunicationWorkspace, isSidebar: true, group: 'SYSTEM SETTINGS', moduleKey: 'communication' },

  // SYSTEM SETTINGS ALIASES (Hidden from sidebar)
  { name: 'System Config Alias', path: '/settings/configuration', roles: ['ADMIN', 'GENERAL_MANAGER'], component: SystemConfigurationWorkspace, isSidebar: false },
  { name: 'System Config Alias 2', path: '/settings/system', roles: ['ADMIN', 'GENERAL_MANAGER'], component: SystemConfigurationWorkspace, isSidebar: false },
  { name: 'Communication Alias', path: '/settings/communication', roles: ['ADMIN', 'GENERAL_MANAGER', 'SENIOR_MANAGER'], component: EmailCommunicationWorkspace, isSidebar: false },
  { name: 'Audit Logs Alias', path: '/settings/audit-logs', roles: ['ADMIN', 'GENERAL_MANAGER', 'SENIOR_MANAGER', 'STORES', 'PRODUCTION', 'DESIGNER'], component: AuditLogsWorkspace, isSidebar: false },

  // PRINTABLE (Not in Sidebar)
  { name: 'DC Print', path: '/dispatch/delivery-challan/:id/print', roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: DeliveryChallanPrintView, isSidebar: false, isPrintable: true },

  // DEV TOOLS (Gated to development environment only)
  ...(Boolean(import.meta.env?.DEV)
    ? [{ name: 'UI Kit Showcase', path: '/dev/ui-kit', icon: FileText, roles: ['ADMIN'] as UserRole[], component: UiKitShowcase, isSidebar: false }]
    : []),
];

export function getRoleDefaultPath(role?: string): string {
  switch (role) {
    case 'DESIGNER':
      return '/design/rm-creation';
    case 'STORES':
      return '/stores/rm-issue';
    case 'PRODUCTION':
      return '/production/rm-receipt';
    case 'SENIOR_MANAGER':
    case 'GENERAL_MANAGER':
    case 'ADMIN':
      return '/overview';
    default:
      return '/overview';
  }
}

export function isPathAllowedForUser(
  path?: string,
  user?: { role?: string; effectiveModules?: string[]; permissionsMap?: Record<string, 'FULL_ACCESS' | 'VIEW' | 'DENY'> } | null,
): boolean {
  if (!path || !user || !user.role) return false;
  if (path === '/' || path === '/login' || path === '/unauthorized') return false;

  if (user.role === 'ADMIN') return true;

  const matchedRoute = ROUTE_CONFIG.find((r) => r.path === path);
  if (!matchedRoute) {
    return false;
  }

  // 1. Explicit Permissions Map overrides (VIEW, FULL_ACCESS, DENY)
  if (matchedRoute.moduleKey && user.permissionsMap) {
    const tier = user.permissionsMap[matchedRoute.moduleKey];
    if (tier === 'DENY') {
      return false; // Denied / hidden from user
    }
    if (tier === 'VIEW' || tier === 'FULL_ACCESS') {
      return true; // Allowed
    }
  }

  const roleAllowed = matchedRoute.roles.includes(user.role as UserRole);

  if (matchedRoute.moduleKey && user.effectiveModules && user.effectiveModules.length > 0) {
    if (
      (matchedRoute.moduleKey === 'production_rm_verify' || matchedRoute.moduleKey === 'rm_receipt') &&
      (user.effectiveModules.includes('production_rm') ||
        user.effectiveModules.includes('rm_issue') ||
        user.effectiveModules.includes('production_rm_verify') ||
        roleAllowed)
    ) return true;
    if (matchedRoute.moduleKey === 'request_return_verify' && (
      user.effectiveModules.includes('extra_requests') || 
      user.effectiveModules.includes('return_verify') || 
      user.effectiveModules.includes('request_return_verify') || 
      user.effectiveModules.includes('rm_issue') ||
      roleAllowed
    )) return true;
    if (matchedRoute.moduleKey === 'production_request_return' && (
      user.effectiveModules.includes('production_rm') || 
      user.effectiveModules.includes('production_consumption') || 
      user.effectiveModules.includes('consumption') || 
      user.effectiveModules.includes('production_request_return') ||
      user.effectiveModules.includes('extra_requests') ||
      user.effectiveModules.includes('return_verify') ||
      user.effectiveModules.includes('rm_issue') ||
      roleAllowed
    )) return true;
    if ((matchedRoute.moduleKey === 'consumption' || matchedRoute.moduleKey === 'production_consumption') && (
      user.effectiveModules.includes('consumption') || 
      user.effectiveModules.includes('production_consumption') ||
      roleAllowed
    )) return true;

    if (user.effectiveModules.includes(matchedRoute.moduleKey)) return true;
    if (roleAllowed) return true;
    return false;
  }

  return roleAllowed;
}

