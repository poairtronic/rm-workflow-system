import { Settings2, BarChart2 } from 'lucide-react';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';

interface SlaConfigurationGridProps {
  data: VendorSlaDto[];
  isLoading: boolean;
  onOverride: (sla: VendorSlaDto) => void;
  onViewCompliance: (vendorId: string) => void;
}

export function SlaConfigurationGrid({ data, isLoading, onOverride, onViewCompliance }: SlaConfigurationGridProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-2">Vendor Name</th>
                <th className="px-6 py-2">Process</th>
                <th className="px-6 py-2 text-right">Standard TAT</th>
                <th className="px-6 py-2 text-right">Buffer</th>
                <th className="px-6 py-2">Active Status</th>
                <th className="px-6 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="h-14 animate-pulse">
                  <td className="px-6 py-2"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                  <td className="px-6 py-2"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                  <td className="px-6 py-2 text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                  <td className="px-6 py-2 text-right"><div className="h-4 bg-slate-200 rounded w-12 ml-auto"></div></td>
                  <td className="px-6 py-2"><div className="h-5 bg-slate-200 rounded-full w-20"></div></td>
                  <td className="px-6 py-2 text-right"><div className="h-8 bg-slate-200 rounded-md w-24 ml-auto"></div></td>
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
        <p className="text-slate-500 text-sm">No Vendor SLAs defined yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-2">Vendor Name</th>
              <th className="px-6 py-2">Process</th>
              <th className="px-6 py-2 text-right">Standard TAT</th>
              <th className="px-6 py-2 text-right">Buffer</th>
              <th className="px-6 py-2">Active Status</th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item) => (
              <tr key={item.id} className="h-14 hover:bg-[#F8FAFC] transition-colors group">
                <td className="px-6 py-2">
                  <div className="font-medium text-slate-900">{item.vendorName}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{item.vendorId}</div>
                </td>
                <td className="px-6 py-2">
                  <div className="font-medium text-slate-700">{item.processName}</div>
                  <div className="text-xs text-slate-400">{item.processId}</div>
                </td>
                <td className="px-6 py-2 text-right tabular-nums font-medium text-slate-700">
                  {item.standardTatDays} <span className="text-xs text-slate-500">Days</span>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                  +{item.toleranceBufferDays} <span className="text-xs text-slate-400">Days</span>
                </td>
                <td className="px-6 py-2">
                  {item.isActive ? (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 gap-1.5 whitespace-nowrap">
                      <span className="h-[6px] w-[6px] rounded-full bg-green-500"></span>
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 gap-1.5 whitespace-nowrap">
                      <span className="h-[6px] w-[6px] rounded-full bg-slate-400"></span>
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewCompliance(item.vendorId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      Compliance
                    </button>
                    <button
                      onClick={() => onOverride(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-amber-700 text-xs font-medium rounded-md hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200 transition-colors"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                      Override
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
