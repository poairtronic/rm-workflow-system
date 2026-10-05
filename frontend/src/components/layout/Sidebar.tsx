import { LayoutDashboard, PackageSearch, BellRing, Box, Shield, Settings, PackageCheck, ShieldCheck, Network, BarChart3, FileText, LogOut, FilePlus, PlaySquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export function Sidebar() {
  const { currentUser, logout } = useAuth();

  const allNavItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard, roles: ['ADMIN'] },
    // DESIGN_ENGINEER
    { name: 'Project Setup', path: '/design/project-setup', icon: FilePlus, roles: ['ADMIN', 'DESIGN_ENGINEER'] },
    { name: 'RM Requisitions', path: '/design/requisitions', icon: FileText, roles: ['ADMIN', 'DESIGN_ENGINEER'] },
    // STORE_CONTROLLER
    { name: 'Issue Material', path: '/stores/issue-material', icon: PackageSearch, roles: ['ADMIN', 'STORE_CONTROLLER'] },
    { name: 'MSL Alerts', path: '/inventory/msl-alerts', icon: BellRing, roles: ['ADMIN', 'STORE_CONTROLLER'] },
    { name: 'DC Type 1', path: '/dispatch/delivery-challan/type-1', icon: Box, roles: ['ADMIN', 'STORE_CONTROLLER'] },
    { name: 'DC Type 2', path: '/dispatch/delivery-challan/type-2', icon: Box, roles: ['ADMIN', 'STORE_CONTROLLER'] },
    { name: 'DC Returns', path: '/dispatch/returns', icon: PackageCheck, roles: ['ADMIN', 'STORE_CONTROLLER'] },
    // PRODUCTION_MGR
    { name: 'Active Jobs', path: '/production/jobs', icon: PlaySquare, roles: ['ADMIN', 'PRODUCTION_MGR'] },
    { name: 'Material Consumption', path: '/production/consumption', icon: PackageSearch, roles: ['ADMIN', 'PRODUCTION_MGR'] },
    // Governance (Admin)
    { name: 'Process Master', path: '/governance/process-master', icon: Settings, roles: ['ADMIN'] },
    { name: 'Vendor SLAs', path: '/governance/vendor-slas', icon: Shield, roles: ['ADMIN'] },
    { name: 'SC Traceability', path: '/governance/traceability', icon: ShieldCheck, roles: ['ADMIN', 'DESIGN_ENGINEER', 'PRODUCTION_MGR'] },
    { name: 'PO Traceability', path: '/governance/po-traceability', icon: Network, roles: ['ADMIN', 'DESIGN_ENGINEER'] },
    { name: 'Vendor Analytics', path: '/governance/vendor-analytics', icon: BarChart3, roles: ['ADMIN'] },
    { name: 'Enterprise Reports', path: '/reports/generation', icon: FileText, roles: ['ADMIN', 'STORE_CONTROLLER'] },
  ];

  const navItems = allNavItems.filter(item => 
    currentUser?.role && item.roles.includes(currentUser.role)
  );

  return (
    <aside className="fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-slate-200 z-30 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <span className="font-semibold text-lg tracking-tight text-primary">RMRIT System</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }: { isActive: boolean }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>
      
      {currentUser && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {currentUser.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{currentUser.name}</p>
              <p className="text-xs text-slate-500">{currentUser.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
