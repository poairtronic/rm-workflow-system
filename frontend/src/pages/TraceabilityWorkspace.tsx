import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react';
import { traceabilityApi } from '../services/api';
import { workflowService, type SC } from '../services/workflowService';
import { ScListTable } from '../components/traceability/ScListTable';
import { TraceabilitySearch } from '../components/traceability/TraceabilitySearch';
import { ScContextBanner } from '../components/traceability/ScContextBanner';
import { LifecycleTimeline } from '../components/traceability/LifecycleTimeline';
import { ZeroLossReconciliation } from '../components/traceability/ZeroLossReconciliation';
import { DcMovementsLedger } from '../components/traceability/DcMovementsLedger';

export function TraceabilityWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlScId = searchParams.get('scId');
  const [scId, setScId] = useState<string | null>(urlScId || null);

  // Sync state with URL search param
  useEffect(() => {
    if (urlScId) {
      setScId(urlScId);
    }
  }, [urlScId]);

  // 1. Fetch complete list of Sales Order Components for total count and individual table items
  const { data: scList = [], isLoading: isLoadingScList } = useQuery<SC[]>({
    queryKey: ['sc-list'],
    queryFn: async () => {
      const res = await workflowService.getScList();
      return Array.isArray(res) ? res : (res as any)?.data || [];
    },
  });

  // 2. Fetch Consolidated Traceability for selected SC
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['traceability', scId],
    queryFn: () => {
      if (!scId) return Promise.reject('No ID');
      return traceabilityApi.getConsolidated(scId);
    },
    enabled: !!scId,
    retry: false, // Don't retry on 404
  });

  const handleSelectSc = (selectedId: string) => {
    setScId(selectedId);
    setSearchParams({ scId: selectedId });
  };

  const handleBackToList = () => {
    setScId(null);
    setSearchParams({});
  };

  const isNotFound = isError && (error as any)?.message?.includes('404');

  return (
    <div className="max-w-[1300px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            SC Traceability & Zero-Loss Audit
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Explore the complete lifecycle, material movements, and mass-balance reconciliation for any Sales Order Component.
          </p>
        </div>

        {/* Back Button if inspecting an SC */}
        {scId && (
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to All SCs ({scList.length})</span>
          </button>
        )}
      </div>

      {/* VIEW A: SC Master Table View (Default when no SC is selected) */}
      {!scId ? (
        <ScListTable
          scs={scList}
          isLoading={isLoadingScList}
          onSelectSc={handleSelectSc}
          selectedScId={scId}
        />
      ) : (
        /* VIEW B: Deep-Dive Traceability Audit View for Selected SC */
        <div className="space-y-6">
          {/* Quick Search / Jump Bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <TraceabilitySearch
                currentScId={scId}
                onSearch={handleSelectSc}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="animate-pulse space-y-6">
              <div className="h-40 bg-slate-200 rounded-xl w-full"></div>
              <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
              <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
            </div>
          )}

          {/* Not Found State */}
          {isNotFound && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-900 mb-2">Component Not Found</h3>
              <p className="text-red-700 mb-4">
                No traceability records exist for SC ID: <strong>{scId}</strong>
              </p>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-red-700 border border-red-300 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to All SCs</span>
              </button>
            </div>
          )}

          {/* Hydrated View */}
          {data && !isLoading && !isError && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
              <ScContextBanner masterData={data.masterData} />

              {/* Subcontracting DC Movements WIP Ledger */}
              <DcMovementsLedger movements={(data as any)?.dcMovements || []} />

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
      )}
    </div>
  );
}
