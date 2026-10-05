import { Search, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function TopBar() {
  const { currentUser, logout } = useAuth();

  return (
    <header className="fixed top-0 right-0 left-[260px] h-16 bg-white/80 backdrop-blur border-b border-slate-200 z-20 flex items-center px-6 justify-between">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative group max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-12 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-block border border-slate-200 rounded px-1.5 text-[10px] font-medium text-slate-500 bg-white">
            CTRL K
          </kbd>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 border-l border-slate-200 pl-6">
          {currentUser && (
            <>
              <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded">
                {currentUser.role.replace('_', ' ')}
              </span>
              <div className="flex flex-col text-right">
                <span className="text-sm font-medium text-slate-900">{currentUser.name || 'User'}</span>
              </div>
              <button 
                onClick={logout}
                className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
