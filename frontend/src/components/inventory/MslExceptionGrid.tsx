import { useState, useMemo } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { MslException } from '../../types/msl-alert';
import { DeficitProgressBar } from './DeficitProgressBar';

const SeverityBadge = ({ severity }: { severity: MslException['severity'] }) => {
  if (severity === 'CRITICAL') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100/10 px-2.5 py-0.5 text-xs font-medium text-red-700 gap-1.5 whitespace-nowrap bg-[#FEE2E2]">
        <span className="h-[6px] w-[6px] rounded-full bg-red-600"></span>
        CRITICAL
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 gap-1.5 whitespace-nowrap bg-[#FEF3C7]">
      <span className="h-[6px] w-[6px] rounded-full bg-amber-600"></span>
      LOW STOCK
    </span>
  );
};

export interface MslExceptionGridProps {
  data: MslException[];
  isLoading?: boolean;
  onRaisePO?: (item: MslException) => void;
}

export function MslExceptionGrid({ data, isLoading, onRaisePO }: MslExceptionGridProps) {
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-2">Item Details</th>
                <th className="px-6 py-2 text-right">Current Stock</th>
                <th className="px-6 py-2 text-right">MSL Threshold</th>
                <th className="px-6 py-2 text-right">Deficit</th>
                <th className="px-6 py-2 text-center">Severity</th>
                <th className="px-6 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="h-14 animate-pulse">
                  <td className="px-6 py-2">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-1.5"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-center">
                    <div className="h-5 bg-slate-200 rounded-full w-24 mx-auto"></div>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="h-8 bg-slate-200 rounded-md w-20 ml-auto"></div>
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
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-32 flex items-center justify-center">
        <p className="text-slate-500 text-sm">No stock breaches match the selected filters.</p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: keyof MslException }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-40 group-hover:opacity-100 transition-opacity" />;
    if (sortDirection === 'asc') return <ArrowUp className="w-3 h-3 ml-1 inline text-blue-600" />;
    return <ArrowDown className="w-3 h-3 ml-1 inline text-blue-600" />;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-2 cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('itemName')}>
                Item Details <SortIcon field="itemName" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('currentStock')}>
                Current Stock <SortIcon field="currentStock" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('mslThreshold')}>
                MSL Threshold <SortIcon field="mslThreshold" />
              </th>
              <th className="px-6 py-2 text-right cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('deficit')}>
                Deficit <SortIcon field="deficit" />
              </th>
              <th className="px-6 py-2 text-center cursor-pointer group hover:bg-slate-100 transition-colors" onClick={() => handleSort('severity')}>
                Severity <SortIcon field="severity" />
              </th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedData.map((item, idx) => (
              <tr key={item.id || idx} className="h-14 hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-2">
                  <div className="font-medium text-slate-900">{item.itemName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span className="tabular-nums whitespace-nowrap">{item.skuCode}</span> <span className="opacity-50 mx-1">•</span> {item.category}
                  </div>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                  {item.currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-[10px] text-slate-400 ml-1 font-sans uppercase tracking-wider">{item.unit}</span>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                  {item.mslThreshold.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  <span className="text-[10px] text-slate-400 ml-1 font-sans uppercase tracking-wider">{item.unit}</span>
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
                  <button
                    onClick={() => onRaisePO && onRaisePO(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 shadow-sm transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    Raise Emergency PO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
