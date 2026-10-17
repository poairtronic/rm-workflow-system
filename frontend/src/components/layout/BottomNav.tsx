import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PackageSearch,
  PackageCheck,
  FilePlus,
  FileText,
  Box,
  Truck,
  ShieldCheck,
  PlaySquare,
  PackagePlus,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface BottomNavItem {
  name: string;
  path: string;
  icon: LucideIcon;
}

export function BottomNav() {
  const { currentUser } = useAuth();
  if (!currentUser) return null;

  const getNavItems = (): BottomNavItem[] => {
    switch (currentUser.role) {
      case 'DESIGNER':
        return [
          { name: 'Overview', path: '/overview', icon: LayoutDashboard },
          { name: 'RM Create', path: '/design/rm-creation', icon: FilePlus },
          { name: 'Requisitions', path: '/design/my-requisitions', icon: FileText },
          { name: 'Stock', path: '/inventory/stock', icon: Box },
        ];
      case 'PRODUCTION':
        return [
          { name: 'Overview', path: '/overview', icon: LayoutDashboard },
          { name: 'RM Receipt', path: '/production/rm-receipt', icon: PackageCheck },
          { name: 'Returns', path: '/production/request-return', icon: PackagePlus },
          { name: 'Consumption', path: '/production/consumption', icon: PlaySquare },
        ];
      case 'SENIOR_MANAGER':
      case 'GENERAL_MANAGER':
        return [
          { name: 'Overview', path: '/overview', icon: LayoutDashboard },
          { name: 'Stock', path: '/inventory/stock', icon: Box },
          { name: 'Traceability', path: '/governance/traceability', icon: ShieldCheck },
          { name: 'Reports', path: '/reports/generation', icon: FileText },
        ];
      case 'STORES':
      case 'ADMIN':
      default:
        return [
          { name: 'Overview', path: '/overview', icon: LayoutDashboard },
          { name: 'RM Issue', path: '/stores/rm-issue', icon: PackageSearch },
          { name: 'Stock', path: '/inventory/stock', icon: Box },
          { name: 'Movements', path: '/dispatch/movements', icon: Truck },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 md:hidden bg-white/95 dark:bg-[#0d0f1b]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#1a1e33] pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.3)] transition-colors"
    >
      <div className="grid grid-cols-4 h-14 items-center">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-full py-1 px-1 transition-all relative select-none cursor-pointer ${
                  isActive
                    ? 'text-primary dark:text-indigo-400 font-bold'
                    : 'text-slate-500 dark:text-[#7a879e] hover:text-slate-900 dark:hover:text-slate-100 font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary dark:bg-indigo-500 rounded-full shadow-xs" />
                  )}
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                      isActive ? 'scale-110 text-primary dark:text-indigo-400' : ''
                    }`}
                  />
                  <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-full text-center">
                    {item.name}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
