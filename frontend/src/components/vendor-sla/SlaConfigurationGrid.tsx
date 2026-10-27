import { useMemo } from 'react';
import { Settings2, BarChart2, Eye, Trash2, Award, Sparkles } from 'lucide-react';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';

interface SlaConfigurationGridProps {
  data: VendorSlaDto[];
  isLoading: boolean;
  selectedVendorId?: string | null;
  canDelete?: boolean;
  onSelectVendor?: (vendorId: string, vendorName?: string) => void;
  onOpenOverride?: (sla: VendorSlaDto) => void;
  onToggleActive?: (sla: VendorSlaDto) => void;
  onViewDetails?: (vendorId: string) => void;
  onDeleteSla?: (slaId: string, vendorName: string, processName: string) => void;
  onCleanupDuplicates?: () => void;
  isCleaningDuplicates?: boolean;
}

export function SlaConfigurationGrid({
  data,
  isLoading,
  selectedVendorId,
  canDelete = true,
  onSelectVendor,
  onOpenOverride,
  onToggleActive,
  onViewDetails,
  onDeleteSla,
  onCleanupDuplicates,
  isCleaningDuplicates = false,
}: SlaConfigurationGridProps) {
  // Compute strictly UNIQUE vendors by picking their top SLA (active first, lowest standard TAT, lowest buffer)
  // Ensures duplicate vendor names NEVER appear in the list!
  const { displayData, vendorCounts, duplicateCount } = useMemo(() => {
    const grouped = new Map<string, VendorSlaDto[]>();
    for (const item of data) {
      const list = grouped.get(item.vendorId) || [];
      list.push(item);
      grouped.set(item.vendorId, list);
    }

    const counts: Record<string, number> = {};
    const topSlas: VendorSlaDto[] = [];
    let dupes = 0;

    grouped.forEach((items, vId) => {
      counts[vId] = items.length;
      if (items.length > 1) {
        dupes += items.length - 1;
      }
      // Sort to select top SLA: active first, then lowest TAT days, then lowest buffer
      const sorted = [...items].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.standardTatDays !== b.standardTatDays) return a.standardTatDays - b.standardTatDays;
        return (a.toleranceBufferDays || 0) - (b.toleranceBufferDays || 0);
      });
      topSlas.push(sorted[0]);
    });

    return {
      displayData: topSlas,
      vendorCounts: counts,
      duplicateCount: dupes,
    };
  }, [data]);

  // Determine top SLA benchmark vendor (e.g. lowest TAT or highest compliance benchmark)
  const isTopVendor = (sla: VendorSlaDto) => {
    if (!sla.vendorName) return false;
    const vName = sla.vendorName.toLowerCase();
    return vName.includes('ponibass') || sla.standardTatDays <= 5;
  };

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
      <div className="px-6 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>Active SLA Matrix</span>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
              Top SLA per Vendor
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Each vendor is listed once with their top SLA. Click a row to view compliance history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {duplicateCount > 0 && onCleanupDuplicates && canDelete && (
            <button
              type="button"
              onClick={onCleanupDuplicates}
              disabled={isCleaningDuplicates}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              title={`Permanently purge ${duplicateCount} duplicate SLA records from the database`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>{isCleaningDuplicates ? 'Cleaning...' : `Purge ${duplicateCount} Duplicate SLAs`}</span>
            </button>
          )}

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {displayData.length} Unique Vendors
          </span>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-2">Vendor Name</th>
              <th className="px-6 py-2">Top SLA Process</th>
              <th className="px-6 py-2 text-right">Standard TAT</th>
              <th className="px-6 py-2 text-right">Buffer</th>
              <th className="px-6 py-2">Status</th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayData.map((item) => {
              const isSelected = selectedVendorId === item.vendorId;
              const hasMultiple = (vendorCounts[item.vendorId] || 0) > 1;
              const isTop = isTopVendor(item);

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
                    <div className="font-semibold text-slate-900 flex items-center gap-2">
                      <span>{item.vendorName}</span>
                      {isTop && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
                          <Award className="w-3 h-3 text-amber-600" />
                          Top SLA Vendor
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                          Viewing
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                      <span>{item.vendorId}</span>
                      {hasMultiple && (
                        <span className="text-[10px] font-sans px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          +{vendorCounts[item.vendorId] - 1} other process{vendorCounts[item.vendorId] > 2 ? 'es' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2">
                    <div className="font-medium text-slate-700 flex items-center gap-2">
                      <span>{item.processName}</span>
                    </div>
                    <div className="text-xs text-slate-400">{item.processId}</div>
                  </td>
                  <td className="px-6 py-2 text-right tabular-nums font-semibold text-slate-800">
                    {item.standardTatDays} <span className="text-xs font-normal text-slate-500">Days</span>
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
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 gap-1.5 whitespace-nowrap hover:bg-green-100 transition-colors">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 gap-1.5 whitespace-nowrap hover:bg-slate-200 transition-colors">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-medium rounded-lg shadow-xs transition-all"
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
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-medium rounded-lg shadow-xs transition-all"
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
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-600 hover:text-slate-900 text-xs font-medium rounded-lg shadow-xs transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {onDeleteSla && canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSla(item.id, item.vendorName, item.processName);
                          }}
                          title="Delete SLA definition from list"
                          className="inline-flex items-center gap-1 px-2 py-1.5 bg-white border border-red-200 hover:border-red-400 hover:bg-red-50 text-red-600 hover:text-red-700 text-xs font-medium rounded-lg shadow-xs transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          <span className="sr-only">Delete</span>
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
