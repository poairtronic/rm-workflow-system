import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { vendorAnalyticsApi, vendorMasterApi, vendorSlaApi } from '../services/api';
import { GlobalVendorDashboard } from '../components/vendor-analytics/GlobalVendorDashboard';
import { VendorDetailProfile } from '../components/vendor-analytics/VendorDetailProfile';
import { EmptyState } from '../components/ui/EmptyState';

export function VendorDashboardWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorId = searchParams.get('vendorId');

  // 1. Fetch Global Performance Analytics
  const { 
    data: globalMetrics, 
    isLoading: isLoadingGlobal,
    isError: isGlobalError,
    error: globalError,
    refetch: refetchGlobal
  } = useQuery({
    queryKey: ['vendor-analytics-global'],
    queryFn: () => vendorAnalyticsApi.getPerformanceAnalytics(),
  });

  // 2. Fetch Master Vendor Directory (all 22 vendors with metadata)
  const {
    data: vendorsMaster = [],
    isLoading: isLoadingVendorsMaster,
  } = useQuery({
    queryKey: ['vendors-master-list'],
    queryFn: () => vendorMasterApi.getAll(),
  });

  // 3. Fetch Master SLAs
  const {
    data: slas = [],
    isLoading: isLoadingSlas,
  } = useQuery({
    queryKey: ['vendor-slas-all'],
    queryFn: () => vendorSlaApi.getAll(),
  });

  // 4. Fetch Selected Vendor Detail Profile
  const { 
    data: vendorProfile, 
    isLoading: isLoadingProfile,
    isError: isProfileError,
  } = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => vendorAnalyticsApi.getVendorProfile(vendorId!),
    enabled: !!vendorId,
    retry: false,
  });

  const handleSelectVendor = (selectedId: string) => {
    setSearchParams({ vendorId: selectedId });
  };

  const handleBackToGlobal = () => {
    setSearchParams({});
  };

  const isGlobalLoading = isLoadingGlobal || isLoadingVendorsMaster || isLoadingSlas;

  return (
    <div className="max-w-[1400px] mx-auto w-full pb-24">
      {/* Workspace Header */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-primary" />
            Vendor Performance & DC Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise oversight of external manufacturing partners, SLA adherence, and active material custody.
          </p>
        </div>
      </div>

      {/* Global Loader */}
      {!vendorId && isGlobalLoading && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
          <p className="text-sm font-medium">Aggregating vendor performance & custody data...</p>
        </div>
      )}

      {/* Profile Loader */}
      {vendorId && isLoadingProfile && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
          <p className="text-sm font-medium">Loading vendor custody ledger & SLA profile...</p>
        </div>
      )}

      {/* Global Error State */}
      {isGlobalError && !vendorId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Failed to load analytics</h3>
          <p className="text-red-700 mb-6">{globalError instanceof Error ? globalError.message : 'An error occurred'}</p>
          <button 
            onClick={() => refetchGlobal()}
            className="px-6 h-10 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 shadow-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Error State for Profile */}
      {isProfileError && vendorId && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-red-900 mb-2">Vendor Profile Not Found</h3>
          <p className="text-red-700 mb-6">We couldn't locate custody analytics for Vendor ID: <strong>{vendorId}</strong></p>
          <button 
            onClick={handleBackToGlobal}
            className="px-6 h-10 bg-white border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-50 shadow-sm transition-colors"
          >
            Return to Global Directory
          </button>
        </div>
      )}

      {/* Global View */}
      {!vendorId && !isGlobalLoading && (
        globalMetrics ? (
          <GlobalVendorDashboard 
            metrics={globalMetrics} 
            vendorsMaster={vendorsMaster}
            slas={slas}
            onSelectVendor={handleSelectVendor}
          />
        ) : (
          <EmptyState title="No vendor metrics" description="There are no vendor metrics available." />
        )
      )}

      {/* Single Vendor Drill Down */}
      {vendorId && !isLoadingProfile && vendorProfile && (
        <VendorDetailProfile 
          profile={vendorProfile} 
          vendorSlas={slas}
          onBack={handleBackToGlobal} 
        />
      )}
    </div>
  );
}
