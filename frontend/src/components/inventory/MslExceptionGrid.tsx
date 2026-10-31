import { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { MslException } from '../../types/msl-alert';
import { DeficitProgressBar } from './DeficitProgressBar';

const SeverityBadge = ({ severity }: { severity: MslException['severity'] }) => {
  if (severity === 'OUT_OF_STOCK') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold gap-1.5 whitespace-nowrap bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
        <span className="h-[6px] w-[6px] rounded-full bg-rose-600"></span>
        OUT OF STOCK
      </span>
    );
  }
  if (severity === 'CRITICAL') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold gap-1.5 whitespace-nowrap bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
        <span className="h-[6px] w-[6px] rounded-full bg-rose-600"></span>
        CRITICAL
      </span>
    );
  }
  if (severity === 'GOOD') {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold gap-1.5 whitespace-nowrap bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
        <span className="h-[6px] w-[6px] rounded-full bg-emerald-600"></span>
        GOOD
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold gap-1.5 whitespace-nowrap bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900">
      <span className="h-[6px] w-[6px] rounded-full bg-amber-600"></span>
      LOW STOCK
    </span>
  );
};

export interface MslExceptionGridProps {
  data: MslException[];
  isLoading?: boolean;
  onAdjustStock?: (item: MslException) => void;
  onViewLedger?: (item: MslException) => void;
}

export function MslExceptionGrid({ data, isLoading, onAdjustStock, onViewLedger }: MslExceptionGridProps) {
  const [sortField, setSortField] = useState<keyof MslException>('deficit');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: keyof MslException) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to desc for a new field, as higher deficit is worse
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return 0;
    });
  }, [data, sortField, sortDirection]);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="h-10 bg-slate-50 dark:bg-[#0e111f] border-b border-slate-200 dark:border-[#1e233d] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-2">Item Details</th>
                <th className="px-6 py-2 text-right">Current Stock</th>
                <th className="px-6 py-2 text-right">MSL Threshold</th>
                <th className="px-6 py-2 text-right">Deficit</th>
                <th className="px-6 py-2 text-center">Severity</th>
                <th className="px-6 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="h-14 animate-pulse">
                  <td className="px-6 py-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4 mb-1.5"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-center">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-24 mx-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-md w-20 ml-auto"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl overflow-hidden shadow-xs h-36 flex flex-col items-center justify-center">
        <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">No stock breaches match the selected filters.</p>
        <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Adjust search keywords or clear filter attributes above.</p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: keyof MslException }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-40 group-hover:opacity-100 transition-opacity" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1 inline text-blue-600 dark:text-blue-400" />;
    return <ArrowDown className="w-3 h-3 ml-1 inline text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 dark:bg-[#0e111f] border-b border-slate-200 dark:border-[#1e233d] text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-6 py-2 cursor-pointer group hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors" onClick={() => handleSort('itemName')}>
                Item Details <SortIcon field="itemName" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors" onClick={() => handleSort('currentStock')}>
                Current Stock <SortIcon field="currentStock" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors" onClick={() => handleSort('mslThreshold')}>
                MSL Threshold <SortIcon field="mslThreshold" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors" onClick={() => handleSort('deficit')}>
                Deficit <SortIcon field="deficit" />
              </th>
              <th className="px-6 py-2 text-center cursor-pointer group hover:bg-slate-100 dark:hover:bg-[#161a2e] transition-colors" onClick={() => handleSort('severity')}>
                Severity <SortIcon field="severity" />
              </th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
            {sortedData.map((item, idx) => (
              <tr key={item.id || idx} className="h-14 hover:bg-slate-50 dark:hover:bg-[#161a2e] transition-colors group">
                <td className="px-6 py-2">
                  <div className="font-semibold text-slate-900 dark:text-white">{item.itemName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="tabular-nums font-mono text-[11px] text-slate-700 dark:text-slate-300 font-semibold">{item.skuCode}</span>
                    <span className="opacity-50 mx-1.5">•</span>
                    <span>{item.category}</span>
                  </div>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200 font-medium">
                  {item.currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1 font-sans uppercase tracking-wider font-semibold">{item.unit}</span>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200 font-medium">
                  {item.mslThreshold.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-1 font-sans uppercase tracking-wider font-semibold">{item.unit}</span>
                </td>
                <td className="px-6 py-2 align-middle">
                  <DeficitProgressBar
                    currentStock={item.currentStock}
                    mslThreshold={item.mslThreshold}
                    unit={item.unit}
                    severity={item.severity}
                  />
                </td>
                <td className="px-6 py-2 text-center">
                  <SeverityBadge severity={item.severity} />
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewLedger && onViewLedger(item)}
                      className="inline-flex items-center px-2 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Review this product's full ledger"
                    >
                      View Ledger
                    </button>
                    <button
                      onClick={() => onAdjustStock && onAdjustStock(item)}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 shadow-xs transition-colors cursor-pointer"
                    >
                      Adjust Stock
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
