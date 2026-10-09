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
    <aside className="fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-slate-200 z-30 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-200">
        <span className="font-semibold text-lg tracking-tight text-primary">RMRIT System</span>
      </div>
      <nav className="flex-1 p-4 overflow-y-auto">
        {Object.entries(groupedItems).map(([group, items]) => (
          <div key={group} className="mb-6">
            {group !== 'GENERAL' && group !== 'OVERVIEW' && (
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
                {group}
              </h3>
            )}
            <div className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon!;
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
            </div>
          </div>
        ))}
      </nav>
      
      {currentUser && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              {(currentUser.name || currentUser.email).charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{currentUser.name || 'User'}</p>
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
