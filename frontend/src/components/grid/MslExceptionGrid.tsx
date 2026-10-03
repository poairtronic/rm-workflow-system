import { DeficitProgressBar } from '../dashboard/DeficitProgressBar';

import { AlertCircle } from 'lucide-react';
import type { MslExceptionRow } from '../../types/inventory';

const mockExceptions: MslExceptionRow[] = [
  {
    id: 'EX-001',
    materialCode: 'RM-EN31-100',
    description: 'EN31 Round Bar Ø 100mm',
    mslTarget: 500,
    currentStock: 50,
    unit: 'KG',
    severity: 'CRITICAL',
    lastUpdated: '2026-10-03 14:30',
  },
  {
    id: 'EX-002',
    materialCode: 'RM-AL6061-50',
    description: 'Al 6061 Block 50mm x 50mm',
    mslTarget: 150,
    currentStock: 95,
    unit: 'KG',
    severity: 'LOW_STOCK',
    lastUpdated: '2026-10-03 15:45',
  },
  {
    id: 'EX-003',
    materialCode: 'RM-SS304-Sheet',
    description: 'SS 304 Sheet 2mm',
    mslTarget: 80,
    currentStock: 0,
    unit: 'Sheets',
    severity: 'CRITICAL',
    lastUpdated: '2026-10-03 09:15',
  },
  {
    id: 'EX-004',
    materialCode: 'RM-BRASS-HEX',
    description: 'Brass Hex Bar 24mm',
    mslTarget: 200,
    currentStock: 160,
    unit: 'KG',
    severity: 'LOW_STOCK',
    lastUpdated: '2026-10-03 11:20',
  }
];

export function MslExceptionGrid({ onRaisePO }: { onRaisePO?: (item: MslExceptionRow) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 p-4 border-b border-slate-100 bg-slate-50">
        <AlertCircle className="w-5 h-5 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900 tracking-wide uppercase">Active MSL Exceptions</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-6 py-4 font-semibold whitespace-nowrap">Material ID</th>
              <th className="px-6 py-4 font-semibold">Description</th>
              <th className="px-6 py-4 font-semibold text-right tabular-nums">MSL Target</th>
              <th className="px-6 py-4 font-semibold w-[250px]">Stock Deficit Analysis</th>
              <th className="px-6 py-4 font-semibold text-right">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {mockExceptions.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors h-14 group">
                <td className="px-6 py-2">
                  <span className="font-medium text-slate-900">{row.materialCode}</span>
                </td>
                <td className="px-6 py-2">
                  <span className="text-sm text-slate-600">{row.description}</span>
                </td>
                <td className="px-6 py-2 text-right">
                  <span className="text-sm font-semibold text-slate-700 tabular-nums">{row.mslTarget} {row.unit}</span>
                </td>
                <td className="px-6 py-2">
                  <DeficitProgressBar 
                    currentStock={row.currentStock} 
                    mslThreshold={row.mslTarget} 
                    unit={row.unit} 
                    severity={row.severity} 
                  />
                </td>
                <td className="px-6 py-2 text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide
                    ${row.severity === 'CRITICAL' 
                      ? 'bg-red-100 text-red-700 border border-red-200' 
                      : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {row.severity === 'CRITICAL' ? 'CRITICAL' : 'LOW STOCK'}
                  </span>
                </td>
                <td className="px-6 py-2 text-right">
                  <button
                    onClick={() => onRaisePO && onRaisePO(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary shadow-sm transition-colors"
                  >
                    Raise PO
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
