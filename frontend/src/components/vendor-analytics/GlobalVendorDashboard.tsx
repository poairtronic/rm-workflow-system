import { Users, TrendingUp, DollarSign, AlertOctagon } from 'lucide-react';
import type { GlobalVendorMetrics } from '../../types/vendor-analytics.dto';
import { AgeingDistributionCharts } from './AgeingDistributionCharts';

interface GlobalVendorDashboardProps {
  metrics: GlobalVendorMetrics;
}

export function GlobalVendorDashboard({ metrics }: GlobalVendorDashboardProps) {
  const isGoodAdherence = metrics.globalSlaAdherencePercentage >= 90;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        {/* Total Vendors Active */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Active Vendors</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{metrics.totalVendorsActive}</p>
            </div>
          </div>
        </div>

        {/* Global SLA Adherence */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isGoodAdherence ? 'bg-emerald-50' : 'bg-amber-50'}`}>
              <TrendingUp className={`w-6 h-6 ${isGoodAdherence ? 'text-emerald-600' : 'text-amber-600'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">SLA Adherence</p>
              <p className={`text-2xl font-bold tabular-nums ${isGoodAdherence ? 'text-emerald-600' : 'text-amber-600'}`}>
                {metrics.globalSlaAdherencePercentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Total Value in Custody */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Value in Custody</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                ${metrics.totalValueInCustody.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Critical Overdue Items */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${metrics.criticalOverdueItems > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
              <AlertOctagon className={`w-6 h-6 ${metrics.criticalOverdueItems > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Critical Overdue</p>
              <p className={`text-2xl font-bold tabular-nums ${metrics.criticalOverdueItems > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {metrics.criticalOverdueItems}
              </p>
            </div>
          </div>
        </div>
      </div>

      <AgeingDistributionCharts data={metrics.ageingBuckets} />
      
    </div>
  );
}
