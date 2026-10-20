import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Network, Search, ChevronRight, AlertCircle, FileBadge, ArrowLeft } from 'lucide-react';
import { traceabilityApi, poApi } from '../services/api';
import { PoListTable } from '../components/traceability/PoListTable';
import { PoKpiMetrics } from '../components/traceability/PoKpiMetrics';
import { ScAggregateGrid } from '../components/traceability/ScAggregateGrid';
import { PoMaterialCharts } from '../components/traceability/PoMaterialCharts';
import { PoDeliveryChallanLog } from '../components/traceability/PoDeliveryChallanLog';
import { StatusBadge } from '../components/ui/StatusBadge';
import { getCanonicalStage, getGeneralizedPoStage, STAGE_CONFIG, type CanonicalStage } from '../utils/canonicalStages';

export function PoTraceabilityWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlPoId = searchParams.get('poId');
  const [poId, setPoId] = useState<string | null>(urlPoId || null);
  const [inputValue, setInputValue] = useState('');

  // Sync state with URL search param
  useEffect(() => {
    if (urlPoId) {
      setPoId(urlPoId);
    }
  }, [urlPoId]);

  // 1. Fetch complete list of Purchase Orders for total count and individual table items
  const { data: poList = [], isLoading: isLoadingPoList } = useQuery<any[]>({
    queryKey: ['po-list'],
    queryFn: async () => {
      const res = await poApi.getAll();
      return Array.isArray(res) ? res : (res as any)?.data || [];
    },
  });

  // 2. Fetch Consolidated Traceability for selected PO
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['po-traceability', poId],
    queryFn: () => {
      if (!poId) return Promise.reject('No ID');
      return traceabilityApi.getPoConsolidated(poId);
    },
    enabled: !!poId,
    retry: false,
  });

  const handleSelectPo = (selectedId: string) => {
    setPoId(selectedId);
    setSearchParams({ poId: selectedId });
  };

  const handleBackToList = () => {
    setPoId(null);
    setSearchParams({});
    setInputValue('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleSelectPo(inputValue.trim());
    }
  };

  const isNotFound = isError && (error as any)?.message?.includes('404');

  return (
    <div className="max-w-[1400px] mx-auto w-full pb-24">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" />
            PO Macro-Traceability Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Aggregate analysis of material utilization, cross-SC dispatch logs, and overall fulfillment for an entire Purchase Order.
          </p>
        </div>

        {/* Back Button if inspecting a PO */}
        {poId && (
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Back to All POs ({poList.length})</span>
          </button>
        )}
      </div>

      {/* VIEW A: PO Master Table View (Default when no PO is selected) */}
      {!poId ? (
        <PoListTable
          pos={poList}
          isLoading={isLoadingPoList}
          onSelectPo={handleSelectPo}
          selectedPoId={poId}
        />
      ) : (
        /* VIEW B: Deep-Dive PO Macro-Traceability View for Selected PO */
        <div className="space-y-6">
          {/* Compact Jump Bar */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex items-center gap-4">
            <div className="flex items-center gap-2 text-slate-500 min-w-max">
              <Search className="w-4 h-4" />
              <span className="text-sm font-medium uppercase tracking-wider">Search PO:</span>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 relative max-w-md">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Lookup another PO number (e.g. PO-2026-9901)..."
                className="w-full h-10 pl-4 pr-10 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim() || inputValue === poId}
                className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-primary disabled:opacity-50 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="animate-pulse space-y-6">
              <div className="h-24 bg-slate-200 rounded-xl w-full"></div>
              <div className="h-32 bg-slate-200 rounded-xl w-full"></div>
              <div className="h-64 bg-slate-200 rounded-xl w-full"></div>
            </div>
          )}

          {/* Not Found State */}
          {isNotFound && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-12 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-900 mb-2">Purchase Order Not Found</h3>
              <p className="text-red-700 mb-4">
                No macro-traceability data exists for PO identifier: <strong>{poId}</strong>
              </p>
              <button
                type="button"
                onClick={handleBackToList}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white text-red-700 border border-red-300 hover:bg-red-50 transition-colors shadow-2xs cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to All Purchase Orders</span>
              </button>
            </div>
          )}

          {/* Hydrated View */}
          {data && !isLoading && !isError && (() => {
            const safePoNumber = (data as any).poNumber || (data as any).po?.poNumber || 'PO';
            const safeCustomerName = (data as any).customerName || (data as any).po?.customer?.name || 'Customer';
            const safePoDate = (data as any).poDate || (data as any).po?.referenceDate || (data as any).po?.createdAt || '';
            const safeTargetDeliveryDate = (data as any).targetDeliveryDate || (data as any).po?.referenceDate || '';
            const rawChildComponents: any[] = (data as any).childComponents || [];
            const generalizedPoStage = getGeneralizedPoStage(rawChildComponents);

            const rawDcItems: any[] = (data as any).dcLogs || 
              (Array.isArray((data as any).deliveryChallans)
                ? (data as any).deliveryChallans
                : (data as any).deliveryChallans?.items || []);

            const safeKpis = (data as any).kpis || {
              totalScs: (data as any).summary?.totalScCount ?? rawChildComponents.length,
              overallFulfillmentPercentage: (data as any).summary?.overallFulfillmentPercentage ?? 0,
              cumulativeMaterialWeightKg: (data as any).rmSummary?.totalOriginalRm ?? 0,
              activeVendorDispatches: (data as any).deliveryChallans?.dispatchedChallans ?? rawDcItems.filter((d: any) => d.status === 'DISPATCHED' || d.status === 'ISSUED' || d.status === 'PARTIALLY_RETURNED').length,
            };
            const safeMaterialChartData = (data as any).materialChartData || [
              {
                materialCategory: 'Raw Material',
                requestedKg: ((data as any).rmSummary?.totalOriginalRm ?? 0) + ((data as any).rmSummary?.totalAdditionalIssued ?? 0),
                consumedKg: (data as any).rmSummary?.totalConsumed ?? 0,
              },
            ];

            const stageDistributionMap: Record<CanonicalStage, number> = {
              'Draft': 0,
              'Design Issued': 0,
              'Stores Pending': 0,
              'Partially Issued': 0,
              'Stores Issued': 0,
              'Production Pending': 0,
              'Production Received': 0,
            };

            rawChildComponents.forEach((c: any) => {
              const stage = getCanonicalStage(c);
              stageDistributionMap[stage] = (stageDistributionMap[stage] || 0) + 1;
            });

            const safeStatusDistribution = Object.entries(stageDistributionMap)
              .filter(([_, count]) => count > 0)
              .map(([stage, count]) => ({
                name: stage,
                value: count,
                color: STAGE_CONFIG[stage as CanonicalStage]?.hexColor || '#3b82f6',
              }));

            const safeScs = rawChildComponents.map((c: any) => ({
              scId: c.scId,
              nomenclature: c.productName || c.scNumber,
              quantityOrdered: c.targetQuantity || 0,
              quantityCompleted: c.rmSummary?.totalConsumed || 0,
              status: getCanonicalStage(c),
            }));

            const safeDcLogs = rawDcItems.map((dc: any) => {
              const scMatch = rawChildComponents.find((c: any) => c.scId === dc.scId || c.scNumber === dc.scReference);
              return {
                dcNumber: dc.challanNumber || dc.dcNumber || 'DC',
                scReference: scMatch?.scNumber || dc.scReference || (dc.scId ? `SC: ${String(dc.scId).slice(0, 8)}...` : 'General / Multi-SC'),
                vendorName: dc.vendor?.name || dc.vendorName || 'N/A',
                dispatchDate: dc.dispatchDate || '',
                expectedReturnDate: dc.expectedReturnDate || '',
                status: dc.status === 'DISPATCHED' ? 'ISSUED' : (dc.status === 'PARTIALLY_RETURNED' ? 'PARTIAL_RETURN' : (dc.status === 'CLOSED' || dc.status === 'RETURNED' ? 'CLOSED' : 'DRAFT')),
              };
            });

            return (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                {/* Context Header */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col md:flex-row md:items-center justify-between p-6 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileBadge className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Order</h2>
                        <StatusBadge status={generalizedPoStage} className="text-[10px] px-2 py-0.5" />
                      </div>
                      <p className="text-xl font-extrabold text-slate-900 font-mono">{safePoNumber}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-8 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Customer</p>
                      <p className="text-sm font-bold text-slate-900">{safeCustomerName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">PO Date</p>
                      <p className="text-sm font-medium text-slate-800 tabular-nums">
                        {safePoDate ? new Date(safePoDate).toLocaleDateString() : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase tracking-wider mb-1 font-semibold">Target Delivery</p>
                      <p className="text-sm font-medium text-slate-800 tabular-nums">
                        {safeTargetDeliveryDate ? new Date(safeTargetDeliveryDate).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  </div>
                </div>

                <PoKpiMetrics kpis={safeKpis} />

                <PoMaterialCharts
                  materialData={safeMaterialChartData}
                  statusData={safeStatusDistribution}
                />

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <ScAggregateGrid scs={safeScs} />
                  <PoDeliveryChallanLog logs={safeDcLogs} />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
