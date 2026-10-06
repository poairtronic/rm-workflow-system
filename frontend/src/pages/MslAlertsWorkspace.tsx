import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { KpiMetricCard } from '../components/dashboard/KpiMetricCard';
import { MslExceptionGrid } from '../components/inventory/MslExceptionGrid';
import { MslFilterPanel, type MslFilters } from '../components/inventory/MslFilterPanel';
import { EmergencyRequisitionDrawer } from '../components/modals/EmergencyRequisitionDrawer';
import { mslApi } from '../services/api';
import type { MslException } from '../types/msl-alert';

export function MslAlertsWorkspace() {
  const [filters, setFilters] = useState<MslFilters>({
    category: '',
    zone: '',
    severity: '',
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<MslException | null>(null);

  const { data: response, isLoading, isError, error } = useQuery({
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
    return response.items.map(item => {
      const stock = Number(item.currentStock) || 0;
      const msl = Number(item.minimumInventory) || 0;
      let computedSeverity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW_STOCK' | 'NORMAL' = 'NORMAL';
      if (msl > 0) {
        if (stock <= 0) computedSeverity = 'OUT_OF_STOCK';
        else if (stock < (msl / 2)) computedSeverity = 'CRITICAL';
        else if (stock < msl) computedSeverity = 'LOW_STOCK';
      }
      return {
        id: item.productId || Math.random().toString(),
        skuCode: item.productId,
        itemName: item.productName,
        category: item.categoryName,
        zone: item.categoryName, // Fallback as zone is not in DTO
        currentStock: stock,
        mslThreshold: msl,
        deficit: Math.max(0, msl - stock),
        unit: 'KG', // Fallback for unit
        severity: computedSeverity,
      };
    }).filter(item => item.severity !== 'NORMAL') as MslException[];
  }, [response]);

  const stats = useMemo(() => {
    if (!response) return { critical: 0, lowStock: 0, itemsBelowMsl: 0, healthIndex: 100 };
    
    // We calculate stats natively in UI because backend rules don't define <50% as CRITICAL
    let critical = 0;
    let lowStock = 0;
    let itemsBelowMsl = 0;
    
    // Fallback to response.summary if we don't have all products, but we only have breached items here.
    // Actually, response.summary has the enterprise totals.
    let monitored = 0;
    response.items.forEach(item => {
      const msl = Number(item.minimumInventory) || 0;
      if (msl > 0) {
        monitored++;
      }
    });
    
    let outOfStock = 0;
    
    // Re-evaluate the breached items based on UI rules
    exceptions.forEach(ex => {
      if (ex.severity === 'OUT_OF_STOCK') outOfStock++;
      if (ex.severity === 'CRITICAL') critical++;
      if (ex.severity === 'LOW_STOCK') lowStock++;
    });
    
    itemsBelowMsl = outOfStock + critical + lowStock;
    const itemsAtOrAbove = Math.max(0, monitored - itemsBelowMsl);
    const healthIndex = monitored > 0 ? Number(((itemsAtOrAbove / monitored) * 100).toFixed(1)) : 100;

    return {
      outOfStock,
      critical,
      lowStock,
      itemsBelowMsl,
      healthIndex,
    };
  }, [response, exceptions]);

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

  const handleRaisePO = (item: MslException) => {
    setSelectedException(item);
    setIsDrawerOpen(true);
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
          onRaisePO={handleRaisePO}
        />
      </div>

      <EmergencyRequisitionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={selectedException}
      />
    </div>
  );
}
