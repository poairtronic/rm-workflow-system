import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Scale,
  Award,
  ShieldCheck,
  Package,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Eye,
  CheckCircle,
} from 'lucide-react';
import { productionProcessApi, vendorSlaApi } from '../../services/api';

interface VendorComparisonViewProps {
  onSelectVendorForCompliance?: (vendorId: string, vendorName: string) => void;
  onViewVendorDossier?: (vendorId: string) => void;
}

export function VendorComparisonView({
  onSelectVendorForCompliance,
  onViewVendorDossier,
}: VendorComparisonViewProps) {
  // 1. Fetch all production processes
  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: ['processes-for-compare'],
    queryFn: () => productionProcessApi.getAll(),
  });

  const [selectedProcessId, setSelectedProcessId] = useState<string>('');

  // Auto-select first process when loaded if none selected
  React.useEffect(() => {
    if (!selectedProcessId && processes.length > 0) {
      setSelectedProcessId(processes[0].id);
    }
  }, [processes, selectedProcessId]);

  // 2. Fetch comparative vendor analytics for chosen process
  const {
    data: comparison = [],
    isLoading: isLoadingComparison,
  } = useQuery({
    queryKey: ['compare-vendors-by-process', selectedProcessId],
    queryFn: () => {
      if (!selectedProcessId) return Promise.resolve([]);
      return vendorSlaApi.compareByProcess(selectedProcessId);
    },
    enabled: !!selectedProcessId,
  });

  const currentProcess = processes.find((p) => p.id === selectedProcessId);

  return (
    <div className="space-y-6">
      {/* Process Selection Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Manufacturing Process Benchmark</h2>
            <p className="text-xs text-slate-500">
              Select a process to compare turnaround times, reliability, and active custody loads across certified vendors.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
            Compare Process:
          </label>
          <select
            value={selectedProcessId}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            disabled={isLoadingProcesses}
            className="h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary min-w-[240px]"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nomenclature} {p.internalCode ? `[${p.internalCode}]` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Grid */}
      {isLoadingComparison ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm animate-pulse space-y-4">
              <div className="h-6 bg-slate-200 rounded w-40"></div>
              <div className="h-4 bg-slate-100 rounded w-28"></div>
              <div className="h-20 bg-slate-50 rounded"></div>
            </div>
          ))}
        </div>
      ) : comparison.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">No Approved Vendors Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            No vendors are currently certified with capabilities for &ldquo;{currentProcess?.nomenclature || 'this process'}&rdquo;.
            You can assign capabilities in the Vendors Master workspace.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Comparing <strong className="text-slate-900">{comparison.length}</strong> certified vendor(s) for{' '}
              <strong className="text-blue-600">{currentProcess?.nomenclature}</strong>
            </span>
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Live AI & Historical TAT Benchmarks
            </span>
          </div>

          {/* Cards Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comparison.map((item) => {
              const beatsSla = item.actualAvgTatDays <= item.agreedSlaDays;
              const isHighReliability = item.onTimeDeliveryRate >= 90;

              return (
                <div
                  key={item.vendorId}
                  className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/40">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors">
                          {item.vendorName}
                        </h3>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                          {item.vendorCode || item.vendorId.slice(0, 8)}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold gap-1 ${
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    {/* Algorithmic Badges */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {item.isFastest && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                          <Award className="w-3 h-3 text-amber-600" />
                          Fastest Turnaround
                        </span>
                      )}
                      {item.isMostReliable && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                          Top Reliability
                        </span>
                      )}
                      {item.isLowestLoad && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                          <Package className="w-3 h-3 text-purple-600" />
                          High Availability
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metrics Body */}
                  <div className="p-5 space-y-4 flex-1">
                    {/* TAT Benchmark Metric */}
                    <div className="grid grid-cols-2 gap-3 bg-slate-50/70 p-3 rounded-lg border border-slate-100">
                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">Agreed SLA</div>
                        <div className="text-lg font-bold text-slate-800 tabular-nums">
                          {item.agreedSlaDays} <span className="text-xs font-normal text-slate-500">Days</span>
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] text-slate-500 font-medium">Actual Avg TAT</div>
                        <div
                          className={`text-lg font-bold tabular-nums flex items-center gap-1 ${
                            beatsSla ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        >
                          <span>{item.actualAvgTatDays}</span>
                          <span className="text-xs font-normal text-slate-500">Days</span>
                          {beatsSla && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                      </div>
                    </div>

                    {/* On-Time Rate Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">On-Time Delivery Rate</span>
                        <span
                          className={`font-bold tabular-nums ${
                            isHighReliability ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {item.onTimeDeliveryRate}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHighReliability ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, item.onTimeDeliveryRate)}%` }}
                        />
                      </div>
                    </div>

                    {/* Operational Load Metrics */}
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Active Custody:</span>
                        <div className="font-semibold text-slate-800 mt-0.5">
                          {item.activeCustodyDcs} Active DC(s)
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Tracked Deliveries:</span>
                        <div className="font-semibold text-slate-800 mt-0.5">
                          {item.totalCompletedJobs} Completed
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onViewVendorDossier?.(item.vendorId)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Deep Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onSelectVendorForCompliance?.(item.vendorId, item.vendorName)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg shadow-sm transition-all"
                    >
                      <span>Analyze Trend</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
