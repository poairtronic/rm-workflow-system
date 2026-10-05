import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Network, Search, ChevronRight, AlertCircle, FileBadge } from 'lucide-react';
import { traceabilityApi } from '../services/api';
import { PoKpiMetrics } from '../components/traceability/PoKpiMetrics';
import { ScAggregateGrid } from '../components/traceability/ScAggregateGrid';
import { PoMaterialCharts } from '../components/traceability/PoMaterialCharts';
import { PoDeliveryChallanLog } from '../components/traceability/PoDeliveryChallanLog';

export function PoTraceabilityWorkspace() {
  const [poId, setPoId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['po-traceability', poId],
    queryFn: () => {
      if (!poId) return Promise.reject('No ID');
      return traceabilityApi.getPoConsolidated(poId);
    },
    enabled: !!poId,
    retry: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setPoId(inputValue.trim());
    }
  };

  const isNotFound = isError && (error as any)?.message?.includes('404');

  return (
    <div className="max-w-[1400px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Network className="w-6 h-6 text-primary" />
          PO Macro-Traceability Dashboard
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Aggregate analysis of material utilization, cross-SC dispatch logs, and overall fulfillment for an entire Purchase Order.
        </p>
      </div>

      {/* Search Bar - Landing vs Compact */}
      {!poId ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh]">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Purchase Order Search</h2>
          <p className="text-slate-500 mb-8 max-w-md text-center">
            Enter a PO Number to generate an aggregate traceability dashboard for all associated Sales Order Components.
          </p>
          
          <form onSubmit={handleSubmit} className="w-full max-w-xl relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g., PO-2026-9901"
              className="w-full h-14 pl-6 pr-16 rounded-xl border border-slate-300 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-secondary transition-colors disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 min-w-max">
            <Search className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-wider">Search PO:</span>
          </div>
          <form onSubmit={handleSubmit} className="flex-1 relative max-w-md">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Lookup another PO..."
              className="w-full h-10 pl-4 pr-10 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
            />
            <button
              type="submit"
              disabled={isLoading || !inputValue.trim() || inputValue === poId}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && poId && (
        <div className="animate-pulse space-y-6">
          <div className="h-24 bg-slate-200 rounded-xl w-full"></div>
          <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
          <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
        </div>
      )}

      {/* Not Found State */}
      {isNotFound && poId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Purchase Order Not Found</h3>
          <p className="text-red-700">No macro-traceability data exists for PO Number: <strong>{poId}</strong></p>
        </div>
      )}

      {/* Hydrated View */}
      {data && !isLoading && !isError && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Context Header */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6 flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileBadge className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Purchase Order</h2>
                <p className="text-xl font-bold text-slate-900">{data.poNumber}</p>
              </div>
            </div>
            
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm font-medium text-slate-900">{data.customerName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">PO Date</p>
                <p className="text-sm font-medium text-slate-900 tabular-nums">{new Date(data.poDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Target Delivery</p>
                <p className="text-sm font-medium text-slate-900 tabular-nums">{new Date(data.targetDeliveryDate).toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          <PoKpiMetrics kpis={data.kpis} />
          
          <PoMaterialCharts 
            materialData={data.materialChartData} 
            statusData={data.statusDistribution} 
          />

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <ScAggregateGrid scs={data.scs} />
            <PoDeliveryChallanLog logs={data.dcLogs} />
          </div>

        </div>
      )}
    </div>
  );
}
