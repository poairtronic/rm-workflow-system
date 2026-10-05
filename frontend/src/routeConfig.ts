import { PackageSearch, BellRing, Box, Shield, Settings, PackageCheck, ShieldCheck, Network, BarChart3, FileText, FilePlus, PlaySquare } from 'lucide-react';
import type { UserRole } from './contexts/AuthContext';
import { IssueMaterialWorkspace } from './pages/IssueMaterialWorkspace';
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
import { ProjectSetupWorkspace } from './pages/ProjectSetupWorkspace';
import { RmRequisitionWorkspace } from './pages/RmRequisitionWorkspace';
import { ProductionJobsWorkspace } from './pages/ProductionJobsWorkspace';
import { ProductionConsumptionWorkspace } from './pages/ProductionConsumptionWorkspace';
import type { ElementType } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  icon?: ElementType;
  roles: UserRole[];
  component: ElementType;
  isSidebar: boolean;
  isPrintable?: boolean;
}

export const ROUTE_CONFIG: RouteConfig[] = [
  // DESIGN
  { name: 'Project Setup', path: '/design/project-setup', icon: FilePlus, roles: ['DESIGNER', 'ADMIN'], component: ProjectSetupWorkspace, isSidebar: true },
  { name: 'RM Requisitions', path: '/design/requisitions', icon: FileText, roles: ['DESIGNER', 'ADMIN'], component: RmRequisitionWorkspace, isSidebar: true },
  
  // STORES
  { name: 'Issue Material', path: '/stores/issue-material', icon: PackageSearch, roles: ['STORES', 'ADMIN'], component: IssueMaterialWorkspace, isSidebar: true },
  { name: 'MSL Alerts', path: '/inventory/msl-alerts', icon: BellRing, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'ADMIN', 'GENERAL_MANAGER'], component: MslAlertsWorkspace, isSidebar: true },
  { name: 'DC Type 1', path: '/dispatch/delivery-challan/type-1', icon: Box, roles: ['STORES', 'ADMIN'], component: Type1DispatchWorkspace, isSidebar: true },
  { name: 'DC Type 2', path: '/dispatch/delivery-challan/type-2', icon: Box, roles: ['STORES', 'ADMIN'], component: Type2DispatchWorkspace, isSidebar: true },
  { name: 'DC Returns', path: '/dispatch/returns', icon: PackageCheck, roles: ['STORES', 'ADMIN'], component: DockReceiptWorkspace, isSidebar: true },
  
  // PRINTABLE (Not in Sidebar)
  { name: 'DC Print', path: '/dispatch/delivery-challan/:id/print', roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: DeliveryChallanPrintView, isSidebar: false, isPrintable: true },

  // PRODUCTION
  { name: 'Active Jobs', path: '/production/jobs', icon: PlaySquare, roles: ['PRODUCTION', 'ADMIN'], component: ProductionJobsWorkspace, isSidebar: true },
  { name: 'Material Consumption', path: '/production/consumption', icon: PackageSearch, roles: ['PRODUCTION', 'ADMIN'], component: ProductionConsumptionWorkspace, isSidebar: true },
  
  // GOVERNANCE
  { name: 'Process Master', path: '/governance/process-master', icon: Settings, roles: ['STORES', 'PRODUCTION', 'ADMIN', 'GENERAL_MANAGER'], component: ProcessMasterWorkspace, isSidebar: true },
  { name: 'Vendor SLAs', path: '/governance/vendor-slas', icon: Shield, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: VendorSlaWorkspace, isSidebar: true },
  { name: 'SC Traceability', path: '/governance/traceability', icon: ShieldCheck, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: TraceabilityWorkspace, isSidebar: true },
  { name: 'PO Traceability', path: '/governance/po-traceability', icon: Network, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: PoTraceabilityWorkspace, isSidebar: true },
  { name: 'Vendor Analytics', path: '/governance/vendor-analytics', icon: BarChart3, roles: ['STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER', 'ADMIN'], component: VendorDashboardWorkspace, isSidebar: true },
  
  // REPORTS
  { name: 'Enterprise Reports', path: '/reports/generation', icon: FileText, roles: ['ADMIN', 'SENIOR_MANAGER', 'GENERAL_MANAGER'], component: ReportGeneratorWorkspace, isSidebar: true },
];
