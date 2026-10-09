import { Users, TrendingUp, Package, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { VendorPerformanceAnalyticsResponseDto } from '../../types/vendor-analytics.dto';
import type { VendorMasterDto } from '../../types/vendor-master.dto';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';
import { AgeingDistributionCharts } from './AgeingDistributionCharts';
import { VendorDirectoryTable } from './VendorDirectoryTable';

interface GlobalVendorDashboardProps {
  metrics: VendorPerformanceAnalyticsResponseDto;
  vendorsMaster: VendorMasterDto[];
  slas: VendorSlaDto[];
  onSelectVendor: (vendorId: string) => void;
}

export function GlobalVendorDashboard({
  metrics,
  vendorsMaster = [],
  slas = [],
  onSelectVendor,
}: GlobalVendorDashboardProps) {
  const summary = metrics?.summary || {
    totalVendors: vendorsMaster.length,
    activeVendors: vendorsMaster.filter((v) => v.isActive).length,
    totalDcs: 0,
    openDcs: 0,
    closedDcs: 0,
    overdueDcs: 0,
    overallSlaComplianceRate: 100,
    avgTurnaroundDays: 0,
    totalCustodyQty: 0,
  };

  const isGoodAdherence = summary.overallSlaComplianceRate >= 90;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {/* Total Vendors Active */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Vendors</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {summary.totalVendors}
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {summary.activeVendors} Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global SLA Adherence */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                isGoodAdherence ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'
              }`}
            >
              <TrendingUp className={`w-6 h-6 ${isGoodAdherence ? 'text-emerald-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA Adherence</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    isGoodAdherence ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {summary.overallSlaComplianceRate.toFixed(1)}%
                </span>
                <span className="text-xs font-normal text-slate-400">
                  across all DCs
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Total Physical Units in Custody */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Material In Custody</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-slate-900 tabular-nums">
                  {summary.totalCustodyQty} <span className="text-sm font-semibold text-slate-500">units</span>
                </span>
                <span className="text-xs text-slate-400">
                  in {summary.openDcs} open DCs
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Overdue Dispatches */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 hover:border-slate-300 transition-colors">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border ${
                summary.overdueDcs > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'
              }`}
            >
              {summary.overdueDcs > 0 ? (
                <AlertTriangle className="w-6 h-6 text-red-600" />
              ) : (
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue DCs</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span
                  className={`text-2xl font-bold tabular-nums ${
                    summary.overdueDcs > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}
                >
                  {summary.overdueDcs}
                </span>
                <span className="text-xs text-slate-400">
                  {summary.overdueDcs === 0 ? 'All on schedule' : 'Require attention'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DC Ageing Risk Distribution Chart */}
      <AgeingDistributionCharts distribution={metrics.ageingDistribution} />

      {/* Comprehensive Vendor Directory & Custody Ledger */}
      <VendorDirectoryTable
        rankings={metrics.vendorRankings || []}
        vendorsMaster={vendorsMaster}
        slas={slas}
        onSelectVendor={onSelectVendor}
      />
    </div>
  );
}
