import { Package, TrendingUp, Scale, Truck } from 'lucide-react';
import type { PoKpiData } from '../../types/po-traceability.dto';

interface PoKpiMetricsProps {
  kpis: PoKpiData;
}

export function PoKpiMetrics({ kpis }: PoKpiMetricsProps) {
  const isGoodFulfillment = kpis.overallFulfillmentPercentage >= 90;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
      {/* Total SCs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total SCs</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{kpis.totalScs}</p>
          </div>
        </div>
      </div>

      {/* Overall Fulfillment */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isGoodFulfillment ? 'bg-emerald-50' : 'bg-amber-50'}`}>
            <TrendingUp className={`w-6 h-6 ${isGoodFulfillment ? 'text-emerald-600' : 'text-amber-600'}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Overall Fulfillment</p>
            <p className={`text-2xl font-bold tabular-nums ${isGoodFulfillment ? 'text-emerald-600' : 'text-amber-600'}`}>
              {kpis.overallFulfillmentPercentage}%
            </p>
          </div>
        </div>
      </div>

      {/* Cumulative Material Weight */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Cumulative Material</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {kpis.cumulativeMaterialWeightKg.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm text-slate-500">KG</span>
            </p>
          </div>
        </div>
      </div>

      {/* Active Vendor Dispatches */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
            <Truck className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Dispatches</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{kpis.activeVendorDispatches}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
