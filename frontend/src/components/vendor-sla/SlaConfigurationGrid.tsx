import { Settings2, BarChart2, Eye } from 'lucide-react';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';

interface SlaConfigurationGridProps {
  data: VendorSlaDto[];
  isLoading: boolean;
  selectedVendorId?: string | null;
  onSelectVendor?: (vendorId: string, vendorName?: string) => void;
  onOpenOverride?: (sla: VendorSlaDto) => void;
  onToggleActive?: (sla: VendorSlaDto) => void;
  onViewDetails?: (vendorId: string) => void;
}

export function SlaConfigurationGrid({
  data,
  isLoading,
  selectedVendorId,
  onSelectVendor,
  onOpenOverride,
  onToggleActive,
  onViewDetails,
}: SlaConfigurationGridProps) {
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
      <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Active SLA Matrix</h2>
          <p className="text-xs text-slate-500">Click any row to view historical compliance, or use action buttons to configure overrides</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          {data.length} Registered SLAs
        </span>
      </div>

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
            {data.map((item) => {
              const isSelected = selectedVendorId === item.vendorId;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectVendor?.(item.vendorId, item.vendorName)}
                  className={`h-14 transition-colors cursor-pointer group ${
                    isSelected
                      ? 'bg-blue-50/60 hover:bg-blue-50 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50/80 border-l-4 border-l-transparent'
                  }`}
                >
                  <td className="px-6 py-2">
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <span>{item.vendorName}</span>
                      {isSelected && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          Viewing
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{item.vendorId}</div>
                  </td>
                  <td className="px-6 py-2">
                    <div className="font-medium text-slate-700">{item.processName}</div>
                    <div className="text-xs text-slate-400">{item.processId}</div>
                  </td>
                  <td className="px-6 py-2 text-right tabular-nums font-medium text-slate-700">
                    {item.standardTatDays} <span className="text-xs text-slate-500">Days</span>
                  </td>
                  <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                    +{item.toleranceBufferDays ?? 1} <span className="text-xs text-slate-400">Days</span>
                  </td>
                  <td className="px-6 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleActive?.(item);
                      }}
                      className="cursor-pointer group/status focus:outline-none"
                      title="Click to toggle status"
                    >
                      {item.isActive ? (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 gap-1.5 whitespace-nowrap hover:bg-green-100 transition-colors">
                          <span className="h-[6px] w-[6px] rounded-full bg-green-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 gap-1.5 whitespace-nowrap hover:bg-slate-200 transition-colors">
                          <span className="h-[6px] w-[6px] rounded-full bg-slate-400"></span>
                          Inactive
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectVendor?.(item.vendorId, item.vendorName);
                        }}
                        title="View historical compliance chart"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-medium rounded-lg shadow-sm transition-all"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Compliance</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenOverride?.(item);
                        }}
                        title="Authorize SLA exception override"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-medium rounded-lg shadow-sm transition-all"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-amber-600" />
                        <span>Override</span>
                      </button>

                      {onViewDetails && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(item.vendorId);
                          }}
                          title="Open detailed vendor intelligence dossier"
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-lg shadow-sm transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
