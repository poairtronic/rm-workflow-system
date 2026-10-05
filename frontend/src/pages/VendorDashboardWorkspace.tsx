import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { vendorAnalyticsApi } from '../services/api';
import { GlobalVendorDashboard } from '../components/vendor-analytics/GlobalVendorDashboard';
import { VendorDetailProfile } from '../components/vendor-analytics/VendorDetailProfile';

export function VendorDashboardWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const vendorId = searchParams.get('vendorId');

  const { 
    data: globalMetrics, 
    isLoading: isLoadingGlobal 
  } = useQuery({
    queryKey: ['vendor-analytics-global'],
    queryFn: () => vendorAnalyticsApi.getPerformanceAnalytics(),
    enabled: !vendorId,
  });

  const { 
    data: vendorProfile, 
    isLoading: isLoadingProfile,
    isError: isProfileError
  } = useQuery({
    queryKey: ['vendor-profile', vendorId],
    queryFn: () => vendorAnalyticsApi.getVendorProfile(vendorId!),
    enabled: !!vendorId,
    retry: false,
  });

  const handleBackToGlobal = () => {
    setSearchParams({});
  };

  return (
    <div className="max-w-[1400px] mx-auto w-full pb-24">
      {/* Workspace Header */}
      <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Vendor Performance & DC Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Enterprise oversight of external manufacturing partners and active material custody.
          </p>
        </div>
        
        {/* Mock Search for Drill Down (for demonstration) */}
        {!vendorId && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const id = fd.get('vendorId') as string;
              if (id) setSearchParams({ vendorId: id });
            }}
            className="flex gap-2"
          >
            <input 
              name="vendorId" 
              type="text" 
              placeholder="Drill down by Vendor ID (e.g., VND-004)" 
              className="w-64 h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            />
            <button type="submit" className="px-4 h-10 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
              Lookup
            </button>
          </form>
        )}
      </div>

      {/* Loaders */}
      {(isLoadingGlobal || isLoadingProfile) && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary" />
          <p className="text-sm font-medium">Aggregating analytics data...</p>
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
            Return to Global Dashboard
          </button>
        </div>
      )}

      {/* Global View */}
      {!vendorId && !isLoadingGlobal && globalMetrics && (
        <GlobalVendorDashboard metrics={globalMetrics} />
      )}

      {/* Single Vendor Drill Down */}
      {vendorId && !isLoadingProfile && vendorProfile && (
        <VendorDetailProfile 
          profile={vendorProfile} 
          onBack={handleBackToGlobal} 
        />
      )}
    </div>
  );
}
