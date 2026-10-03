import { RotateCcw } from 'lucide-react';

export interface MslFilters {
  category: string;
  zone: string;
  severity: string;
}

interface MslFilterPanelProps {
  filters: MslFilters;
  onFilterChange: (key: keyof MslFilters, value: string) => void;
  onReset: () => void;
}

export function MslFilterPanel({ filters, onFilterChange, onReset }: MslFilterPanelProps) {
  return (
    <div className="flex flex-row items-center gap-4 mb-6">
      <select
        value={filters.category}
        onChange={(e) => onFilterChange('category', e.target.value)}
        className="h-10 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 px-3 min-w-[200px] outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 transition-shadow"
      >
        <option value="">All Categories</option>
        <option value="Raw Material / Yarns">Raw Material / Yarns</option>
        <option value="Trims & Fasteners">Trims & Fasteners</option>
        <option value="Dyes & Chemicals">Dyes & Chemicals</option>
      </select>

      <select
        value={filters.zone}
        onChange={(e) => onFilterChange('zone', e.target.value)}
        className="h-10 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 px-3 min-w-[200px] outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 transition-shadow"
      >
        <option value="">All Zones</option>
        <option value="Zone A (Main)">Zone A (Main)</option>
        <option value="Zone B (Heavy)">Zone B (Heavy)</option>
        <option value="Zone C (Chemicals)">Zone C (Chemicals)</option>
      </select>

      <select
        value={filters.severity}
        onChange={(e) => onFilterChange('severity', e.target.value)}
        className="h-10 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 px-3 min-w-[200px] outline-none focus:border-slate-300 focus:ring-1 focus:ring-slate-200 transition-shadow"
      >
        <option value="">All Statuses</option>
        <option value="CRITICAL">Critical</option>
        <option value="LOW_STOCK">Low Stock</option>
      </select>

      <button
        onClick={onReset}
        className="h-10 px-4 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 flex items-center gap-2 hover:bg-slate-50 transition-colors"
      >
        <RotateCcw className="w-4 h-4 text-slate-500" />
        Reset
      </button>
    </div>
  );
}
