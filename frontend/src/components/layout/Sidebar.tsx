import { LayoutDashboard, PackageSearch, BellRing, Box, Shield, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

export function Sidebar() {
  const navItems = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'Issue Material', path: '/stores/issue-material', icon: PackageSearch },
    { name: 'MSL Alerts', path: '/inventory/msl-alerts', icon: BellRing },
    { name: 'DC Module', path: '/dispatch/delivery-challan/type-1', icon: Box },
    { name: 'Process Master', path: '/governance/process-master', icon: Settings },
    { name: 'Vendor SLAs', path: '/governance/vendor-slas', icon: Shield },
  ];

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
    </aside>
  );
}
