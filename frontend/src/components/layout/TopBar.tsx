import { Search, User, Terminal } from 'lucide-react';

export function TopBar() {
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
            ⌘K
          </kbd>
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-medium">PLANT BLR-01</span>
          <span className="text-slate-400">•</span>
          <span>Terminal #04</span>
        </div>
        
        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
          <span className="text-xs font-bold px-2 py-1 bg-primary/10 text-primary rounded">STORES</span>
          <button className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-300 transition-colors">
            <User className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
