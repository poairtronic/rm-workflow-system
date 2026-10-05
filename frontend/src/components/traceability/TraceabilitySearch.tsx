import { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

interface TraceabilitySearchProps {
  currentScId: string | null;
  onSearch: (scId: string) => void;
  isLoading: boolean;
}

export function TraceabilitySearch({ currentScId, onSearch, isLoading }: TraceabilitySearchProps) {
  const [inputValue, setInputValue] = useState(currentScId || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSearch(inputValue.trim());
    }
  };

  if (!currentScId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <Search className="w-10 h-10 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">SC Traceability Portal</h2>
        <p className="text-slate-500 mb-8 max-w-md text-center">
          Enter a Sales Order Component (SC) ID or engineering drawing number to reconstruct its complete lifecycle audit trail.
        </p>
        
        <form onSubmit={handleSubmit} className="w-full max-w-xl relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="e.g., SC-2026-045"
            className="w-full h-14 pl-6 pr-16 rounded-xl border border-slate-300 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-secondary transition-colors disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    );
  }

  // Compact Mode
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6 flex items-center gap-4">
      <div className="flex items-center gap-2 text-slate-500 min-w-max">
        <Search className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-wider">Traceability Search:</span>
      </div>
      <form onSubmit={handleSubmit} className="flex-1 relative max-w-md">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Lookup another SC..."
          className="w-full h-10 pl-4 pr-10 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim() || inputValue === currentScId}
          className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary disabled:opacity-50"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
