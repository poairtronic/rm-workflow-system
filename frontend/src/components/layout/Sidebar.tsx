import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTE_CONFIG } from '../../routeConfig';

export function Sidebar() {
  const { currentUser, logout } = useAuth();

  const navItems = ROUTE_CONFIG.filter(item => {
    if (!item.isSidebar || !currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.effectiveModules && item.moduleKey) {
      return currentUser.effectiveModules.includes(item.moduleKey);
    }
    return item.roles.includes(currentUser.role);
  });

  // Group items by `group` property
  const groupedItems = navItems.reduce((acc, item) => {
    const groupName = item.group || 'GENERAL';
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  return (
    <aside className="fixed top-0 bottom-0 left-0 w-[260px] bg-white dark:bg-[#0d0f1b] border-r border-slate-200 dark:border-[#1a1e33] z-30 flex flex-col transition-colors duration-150">
      <div className="h-16 flex items-center px-6 border-b border-slate-200 dark:border-[#1a1e33]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-sm shadow-xs">
            R
          </div>
          <div>
            <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block leading-none">RMRIT</span>
            <span className="text-[10px] text-slate-400 dark:text-[#7a879e] font-medium tracking-wider uppercase">Material Governance</span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3.5 overflow-y-auto space-y-4">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group} className="space-y-1">
            {group !== 'GENERAL' && group !== 'OVERVIEW' && (
              <h3 className="text-[11px] font-bold text-slate-400 dark:text-[#55627a] uppercase tracking-wider mb-1.5 px-3">
                {group}
              </h3>
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const Icon = item.icon!;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    className={({ isActive }: { isActive: boolean }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-primary/10 text-primary dark:bg-indigo-500/15 dark:text-indigo-400 dark:border dark:border-indigo-500/25 shadow-xs'
                          : 'text-slate-600 dark:text-[#94a3b8] hover:bg-slate-50 dark:hover:bg-[#141829] hover:text-slate-900 dark:hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      {currentUser && (
        <div className="p-3.5 border-t border-slate-200 dark:border-[#1a1e33] bg-slate-50 dark:bg-[#0a0c16]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
              {(currentUser.name || currentUser.email).charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{currentUser.name || 'User'}</p>
              <p className="text-[10px] text-slate-500 dark:text-[#7a879e] font-medium capitalize truncate">{currentUser.role.toLowerCase().replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-white dark:bg-[#161a2e] border border-red-200 dark:border-rose-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shadow-2xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
