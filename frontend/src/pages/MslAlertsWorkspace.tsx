import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { KpiMetricCard } from '../components/dashboard/KpiMetricCard';
import { MslExceptionGrid } from '../components/inventory/MslExceptionGrid';
import { MslFilterPanel, type MslFilters } from '../components/inventory/MslFilterPanel';
import { useNavigate } from 'react-router-dom';
import { StockMovementModal } from '../components/inventory/StockMovementModal';
import { mslApi } from '../services/api';
import type { MslException } from '../types/msl-alert';

export function MslAlertsWorkspace() {
  const [filters, setFilters] = useState<MslFilters>({
    category: '',
    zone: '',
    severity: '',
  });

  const navigate = useNavigate();

  // Temporary drawer state for "Adjust Stock" (assuming F2.2 Stock In modal will replace this later)
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MslException | null>(null);

  const { data: response, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['inventoryMslStatus'],
    queryFn: () => mslApi.getInventoryMslStatus(),
    refetchInterval: 30000, // 30 seconds polling
  });

  useEffect(() => {
    if (isError) {
      console.error('Error fetching MSL alerts:', error);
      toast.error('Live sync disconnected. Retrying...');
    }
  }, [isError, error]);

  const exceptions: MslException[] = useMemo(() => {
    if (!response) return [];
    return response.items.map(item => ({
      id: item.productId || Math.random().toString(),
      skuCode: item.productId,
      itemName: item.productName,
      category: item.categoryName,
      zone: item.categoryName,
      currentStock: Number(item.currentStock) || 0,
      mslThreshold: Number(item.minimumInventory) || 0,
      deficit: Number(item.deficitQty) || 0,
      unit: 'KG',
      severity: item.status === 'BELOW_MSL' ? 'LOW_STOCK' : item.status as any,
    }));
  }, [response]);

  const stats = useMemo(() => {
    if (!response || !response.summary) {
      return { outOfStock: 0, critical: 0, lowStock: 0, itemsBelowMsl: 0, healthIndex: 100 };
    }
    const summary = response.summary;
    const monitored = summary.totalMonitoredProducts || 1;
    const normal = summary.normalStockCount || 0;
    const healthIndex = Math.round((normal / monitored) * 100);
    return {
      outOfStock: summary.outOfStockCount,
      critical: summary.criticalStockCount,
      lowStock: summary.belowMslCount,
      itemsBelowMsl: summary.outOfStockCount + summary.criticalStockCount + summary.belowMslCount,
      healthIndex,
    };
  }, [response]);

  const handleFilterChange = (key: keyof MslFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setFilters({ category: '', zone: '', severity: '' });
  };

  const filteredExceptions = useMemo(() => {
    return exceptions.filter(item => {
      const matchCategory = filters.category === '' || item.category === filters.category;
      const matchZone = filters.zone === '' || item.zone === filters.zone;
      const matchSeverity = filters.severity === '' || item.severity === filters.severity;
      return matchCategory && matchZone && matchSeverity;
    });
  }, [filters, exceptions]);

  const handleAdjustStock = (item: MslException) => {
    // Open Stock In modal pre-filled with this product
    setSelectedProduct(item);
    setIsStockInModalOpen(true);
  };

  const handleViewLedger = (item: MslException) => {
    navigate(`/inventory/stock?tab=LEDGER&product=${encodeURIComponent(item.itemName)}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">MSL Alerts</h1>
        <p className="text-slate-500 mt-1 text-sm">Automated real-time threshold monitoring and safety buffer guardrails</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Out of Stock"
            value={(stats.outOfStock ?? 0).toString().padStart(2, '0')}
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="Zero Stock / Stockout Risk"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Critical Breaches"
            value={stats.critical.toString().padStart(2, '0')}
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="<50% MSL"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Low Stock Alerts"
            value={stats.lowStock.toString().padStart(2, '0')}
            icon={<AlertTriangle className="w-5 h-5" />}
            statusLabel="Below MSL Target"
            colorScheme="warning"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Inventory Health Index"
            value={`${stats.healthIndex}%`}
            icon={<Activity className="w-5 h-5" />}
            statusLabel="Target: >90.0% Optimal"
            colorScheme="success"
          />
        </div>
      </div>
      
      <div className="mt-2">
        <h2 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Live Exceptions</h2>
        <MslFilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleReset}
        />
        <MslExceptionGrid 
          data={filteredExceptions} 
          isLoading={isLoading}
          onAdjustStock={handleAdjustStock}
          onViewLedger={handleViewLedger}
        />
      </div>

      {isStockInModalOpen && (
        <StockMovementModal
          isOpen={isStockInModalOpen}
          onClose={() => setIsStockInModalOpen(false)}
          mode="STOCK_IN"
          initialProductId={selectedProduct?.skuCode}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
