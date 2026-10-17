import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { UnifiedOverviewResponseDto } from '../types/overview.dto';
import { OverviewHeaderMetrics } from '../components/overview/OverviewHeaderMetrics';
import { ModuleTabSelector, type OverviewTabKey } from '../components/overview/ModuleTabSelector';
import { RmProductionOverviewTab } from '../components/overview/RmProductionOverviewTab';
import { StockInventoryOverviewTab } from '../components/overview/StockInventoryOverviewTab';
import { DeliveryChallanOverviewTab } from '../components/overview/DeliveryChallanOverviewTab';

export function OverviewPage() {
  const [activeTab, setActiveTab] = useState<OverviewTabKey>('rm-workflow');

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<UnifiedOverviewResponseDto>({
    queryKey: ['unified-overview'],
    queryFn: async () => {
      return api.get<UnifiedOverviewResponseDto>('/api/dashboards/overview');
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-10 w-full max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-slate-200 dark:border-[#1a1e33]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            System Overview & Operations Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#8896ab] mt-0.5 sm:mt-1">
            Real-time operational intelligence across RM Workflows, Inventory Balances, and Delivery Challans
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#121526] border border-slate-300 dark:border-[#1e233d] rounded-xl hover:bg-slate-50 dark:hover:bg-[#161a2e] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link
            to="/reports/generation"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[44px] text-xs font-semibold text-white bg-primary dark:bg-indigo-600 rounded-xl hover:bg-primary/90 dark:hover:bg-indigo-500 transition-colors shadow-2xs cursor-pointer text-center"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Reports</span>
          </Link>
        </div>
      </div>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-700">Loading live operational data...</p>
          <p className="text-xs text-slate-400 mt-1">Aggregating records across shop floor, stock, and vendors</p>
        </div>
      )}

      {isError && (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-xl text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-rose-900">Failed to load system overview</h3>
          <p className="text-xs text-rose-600 mt-1 max-w-md mx-auto">
            {(error as any)?.message || 'An error occurred while communicating with the server.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* Main Dashboard Content */}
      {data && (
        <div className="space-y-6">
          {/* 1. Universal Top 4 Executive KPI Banner */}
          <OverviewHeaderMetrics summary={data.summary} />

          {/* 2. Interactive 3-Pillar Module Selector */}
          <ModuleTabSelector
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={{
              scs: data.rmWorkflow.totalScs,
              stock: data.stockInventory.totalStockQuantity,
              dcs: data.deliveryChallan.openDcs,
            }}
          />

          {/* 3. Dynamic Module Deep Dive Content */}
          {activeTab === 'rm-workflow' && (
            <RmProductionOverviewTab data={data.rmWorkflow} />
          )}

          {activeTab === 'stock-inventory' && (
            <StockInventoryOverviewTab data={data.stockInventory} />
          )}

          {activeTab === 'delivery-challan' && (
            <DeliveryChallanOverviewTab data={data.deliveryChallan} />
          )}
        </div>
      )}
    </div>
  );
}
