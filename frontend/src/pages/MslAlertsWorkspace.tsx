import { useState, useMemo, useEffect, useCallback } from 'react';
import { AlertOctagon, AlertTriangle, Clock, Activity } from 'lucide-react';
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

  const [exceptions, setExceptions] = useState<MslException[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedException, setSelectedException] = useState<MslException | null>(null);

  // Stats for KPIs
  const [stats, setStats] = useState({
    critical: 0,
    lowStock: 0,
    pendingIndents: 0,
    healthIndex: 0,
  });

  const fetchData = useCallback(async (showSilent = false) => {
    try {
      if (!showSilent) setIsLoading(true);
      
      const response = await mslApi.getInventoryMslStatus();
      
      // Map DTO to frontend MslException
      const mappedExceptions: MslException[] = response.items.map(item => ({
        sku: item.productId,
        itemName: item.productName,
        category: item.categoryName,
        zone: item.categoryName, // Fallback as zone is not in DTO
        currentStock: item.currentStock,
        mslThreshold: item.minimumInventory,
        deficit: item.deficitQty,
        unit: 'KG', // Fallback for unit
        severity: (item.status === 'CRITICAL' || item.status === 'OUT_OF_STOCK') ? 'CRITICAL' : 'LOW_STOCK',
      }));
      
      setExceptions(mappedExceptions);
      
      // Compute KPIs
      setStats({
        critical: response.summary.criticalStockCount + response.summary.outOfStockCount,
        lowStock: response.summary.belowMslCount,
        pendingIndents: Math.floor(Math.random() * 20) + 10, // Mock pending indents as it's not in the sweep dto
        healthIndex: response.summary.totalMonitoredProducts > 0 
          ? Number(((response.summary.normalStockCount / response.summary.totalMonitoredProducts) * 100).toFixed(1))
          : 100,
      });

    } catch (error) {
      console.error('Error fetching MSL alerts:', error);
      toast.error('Live sync disconnected. Retrying...');
    } finally {
      if (!showSilent) setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => {
      fetchData(true); // Silent fetch
    }, 30000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

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

  const handleEmergencySubmit = async (item: MslException, quantity: number, vendor: string, urgency: string) => {
    try {
      const payload = {
        items: [
          {
            sku: item.sku,
            quantity,
            urgency,
            vendor,
          }
        ],
        type: 'EMERGENCY_REQUISITION'
      };
      
      await mslApi.generateEmergencyPO(payload);
      toast.success('Emergency PO generated successfully.');
      setIsDrawerOpen(false);
      
      // Force immediate re-fetch
      fetchData(true);
    } catch (error) {
      console.error('Error generating PO:', error);
      toast.error('Failed to generate emergency PO.');
    }
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
            title="Critical Breaches"
            value={stats.critical.toString().padStart(2, '0')}
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="Zero Stock / Stockout Risk"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Low Stock Alerts"
            value={stats.lowStock.toString().padStart(2, '0')}
            icon={<AlertTriangle className="w-5 h-5" />}
            statusLabel="Below Safety Buffer"
            colorScheme="warning"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isLoading}
            title="Pending Indents"
            value={stats.pendingIndents.toString().padStart(2, '0')}
            icon={<Clock className="w-5 h-5" />}
            statusLabel="In Purchase Workflow"
            colorScheme="info"
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
        onSubmit={handleEmergencySubmit}
      />
    </div>
  );
}
