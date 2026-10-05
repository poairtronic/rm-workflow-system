import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { traceabilityApi } from '../services/api';
import { TraceabilitySearch } from '../components/traceability/TraceabilitySearch';
import { ScContextBanner } from '../components/traceability/ScContextBanner';
import { LifecycleTimeline } from '../components/traceability/LifecycleTimeline';
import { ZeroLossReconciliation } from '../components/traceability/ZeroLossReconciliation';

export function TraceabilityWorkspace() {
  const [scId, setScId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['traceability', scId],
    queryFn: () => {
      if (!scId) return Promise.reject('No ID');
      return traceabilityApi.getConsolidated(scId);
    },
    enabled: !!scId,
    retry: false, // Don't retry on 404
  });

  const handleSearch = (id: string) => {
    setScId(id);
  };

  const isNotFound = isError && (error as any)?.message?.includes('404');

  return (
    <div className="max-w-[1200px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          SC Traceability & Zero-Loss Audit
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Explore the complete lifecycle, material movements, and mass-balance reconciliation for any Sales Order Component.
        </p>
      </div>

      <TraceabilitySearch 
        currentScId={scId} 
        onSearch={handleSearch} 
        isLoading={isLoading} 
      />

      {/* Loading Skeleton */}
      {isLoading && scId && (
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-slate-200 rounded-xl w-full"></div>
          <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
          <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
        </div>
      )}

      {/* Not Found State */}
      {isNotFound && scId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Component Not Found</h3>
          <p className="text-red-700">No traceability records exist for SC ID: <strong>{scId}</strong></p>
        </div>
      )}

      {/* Hydrated View */}
      {data && !isLoading && !isError && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
          <ScContextBanner masterData={data.masterData} />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <LifecycleTimeline events={data.events} />
            </div>
            <div className="lg:col-span-1">
              <ZeroLossReconciliation metrics={data.reconciliation} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
