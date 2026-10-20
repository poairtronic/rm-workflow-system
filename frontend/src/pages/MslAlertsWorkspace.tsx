import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { KpiMetricCard } from '../components/dashboard/KpiMetricCard';
import { MslExceptionGrid } from '../components/inventory/MslExceptionGrid';
import { MslFilterPanel } from '../components/inventory/MslFilterPanel';
import { useNavigate } from 'react-router-dom';
import { mslApi } from '../services/api';
import type { MslException } from '../types/msl-alert';
import { masterDataService } from '../services/masterDataService';
import type {
  Product,
  Category,
  Family,
  Warehouse,
  Location,
  Rack,
  Bin,
} from '../services/masterDataService';
import { inventoryService, type StockBalance } from '../services/inventoryService';
import type { ExportColumn } from '../utils/exportUtils';

export function MslAlertsWorkspace() {
  const navigate = useNavigate();

  // Search & Collapsible Panel State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Secondary Filter Attributes
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [uomFilter, setUomFilter] = useState('');
  const [mslFilter, setMslFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Master Data & Balances
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isMasterDataLoading, setIsMasterDataLoading] = useState(false);

  const loadMasterData = useCallback(async () => {
    setIsMasterDataLoading(true);
    try {
      const [prodRes, catRes, famRes, whRes, locRes, rackRes, binRes, balRes] = await Promise.all([
        masterDataService.getProducts({ pageSize: 1000 }).catch(() => ({ data: [] })),
        masterDataService.getCategories({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getFamilies({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getWarehouses({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getLocations({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getRacks({ pageSize: 1000 }).catch(() => ({ data: [] })),
        masterDataService.getBins({ pageSize: 1000 }).catch(() => ({ data: [] })),
        inventoryService.getAllBalances({ page: 1, pageSize: 2000 }).catch(() => ({ data: [] })),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setFamilies(famRes.data || []);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
      setRacks(rackRes.data || []);
      setBins(binRes.data || []);
      setBalances(balRes.data || []);
    } catch {
      console.error('Failed to load MSL filter master data');
    } finally {
      setIsMasterDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // MSL Status Query
  const {
    data: response,
    isLoading: isMslLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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

  // Fast maps
  const productsMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const famMap = useMemo(() => new Map(families.map((f) => [f.id, f])), [families]);

  // Map each product to all bins and storage locations it resides in
  const productLocationMap = useMemo(() => {
    const map = new Map<
      string,
      {
        binIds: Set<string>;
        binCodes: Set<string>;
        rackIds: Set<string>;
        locationIds: Set<string>;
        warehouseIds: Set<string>;
      }
    >();

    balances.forEach((b) => {
      if (!b.productId) return;
      let entry = map.get(b.productId);
      if (!entry) {
        entry = {
          binIds: new Set(),
          binCodes: new Set(),
          rackIds: new Set(),
          locationIds: new Set(),
          warehouseIds: new Set(),
        };
        map.set(b.productId, entry);
      }
      if (b.binId) entry.binIds.add(b.binId);
      if (b.binCode) entry.binCodes.add(b.binCode.toLowerCase());
      if (b.rackId) entry.rackIds.add(b.rackId);
      if (b.locationId) entry.locationIds.add(b.locationId);
      if (b.warehouseId) entry.warehouseIds.add(b.warehouseId);
    });

    return map;
  }, [balances]);

  // Map raw response to exceptions with resolved codes & severities
  const exceptions: MslException[] = useMemo(() => {
    if (!response) return [];
    return response.items.map((item) => {
      const p = productsMap.get(item.productId);
      const displaySku = p?.code || item.productId;
      const currentStock = Number(item.currentStock) || 0;
      const minInventory = Number(item.minimumInventory) || 0;

      let severity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW_STOCK' = 'LOW_STOCK';
      if (item.status === 'OUT_OF_STOCK' || currentStock <= 0) {
        severity = 'OUT_OF_STOCK';
      } else if (item.status === 'CRITICAL' || currentStock <= minInventory * 0.5) {
        severity = 'CRITICAL';
      } else {
        severity = 'LOW_STOCK';
      }

      return {
        id: item.productId || Math.random().toString(),
        skuCode: displaySku,
        itemName: item.productName,
        category: item.categoryName,
        zone: item.categoryName,
        currentStock,
        mslThreshold: minInventory,
        deficit: Number(item.deficitQty) || 0,
        unit: item.uom || p?.uom || 'NOS',
        severity,
      };
    });
  }, [response, productsMap]);

  // Summary stats
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

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count++;
    if (selectedFamilies.length > 0) count++;
    if (selectedWarehouses.length > 0) count++;
    if (selectedLocations.length > 0) count++;
    if (selectedRacks.length > 0) count++;
    if (selectedBins.length > 0) count++;
    if (uomFilter) count++;
    if (mslFilter) count++;
    if (statusFilter) count++;
    return count;
  }, [
    selectedCategories,
    selectedFamilies,
    selectedWarehouses,
    selectedLocations,
    selectedRacks,
    selectedBins,
    uomFilter,
    mslFilter,
    statusFilter,
  ]);

  const handleResetAll = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedFamilies([]);
    setSelectedWarehouses([]);
    setSelectedLocations([]);
    setSelectedRacks([]);
    setSelectedBins([]);
    setUomFilter('');
    setMslFilter('');
    setStatusFilter('');
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), loadMasterData()]);
    toast.success('MSL monitoring data refreshed');
  };

  // Comprehensive multi-dimensional filtering
  const filteredExceptions = useMemo(() => {
    return exceptions.filter((item) => {
      const p = productsMap.get(item.id);
      const locData = productLocationMap.get(item.id);

      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = item.itemName.toLowerCase().includes(q);
        const matchesSku = item.skuCode.toLowerCase().includes(q);
        const matchesPCode = p?.code ? p.code.toLowerCase().includes(q) : false;
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesBin = locData
          ? Array.from(locData.binCodes).some((code) => code.includes(q))
          : false;

        if (!matchesName && !matchesSku && !matchesPCode && !matchesCategory && !matchesBin) {
          return false;
        }
      }

      // 2. Categories
      if (selectedCategories.length > 0) {
        const catId =
          (p as any)?.categoryId ||
          p?.family?.categoryId ||
          famMap.get(p?.familyId || '')?.categoryId;
        const matchesCatId = catId ? selectedCategories.includes(catId) : false;
        const matchesCatName = categories.some(
          (c) =>
            selectedCategories.includes(c.id) &&
            c.name.toLowerCase() === item.category.toLowerCase()
        );
        if (!matchesCatId && !matchesCatName) {
          return false;
        }
      }

      // 3. Families
      if (selectedFamilies.length > 0) {
        const famId = p?.familyId;
        const matchesFamId = famId ? selectedFamilies.includes(famId) : false;
        const matchesFamName = families.some(
          (f) =>
            selectedFamilies.includes(f.id) &&
            (item.itemName.toLowerCase().includes(f.name.toLowerCase()) ||
              (p?.family?.name && p.family.name.toLowerCase() === f.name.toLowerCase()))
        );
        if (!matchesFamId && !matchesFamName) {
          return false;
        }
      }

      // 4. Warehouses
      if (selectedWarehouses.length > 0) {
        if (!locData || !selectedWarehouses.some((wId) => locData.warehouseIds.has(wId))) {
          return false;
        }
      }

      // 5. Locations
      if (selectedLocations.length > 0) {
        if (!locData || !selectedLocations.some((lId) => locData.locationIds.has(lId))) {
          return false;
        }
      }

      // 6. Racks
      if (selectedRacks.length > 0) {
        if (!locData || !selectedRacks.some((rId) => locData.rackIds.has(rId))) {
          return false;
        }
      }

      // 7. Bins
      if (selectedBins.length > 0) {
        if (!locData || !selectedBins.some((bId) => locData.binIds.has(bId))) {
          return false;
        }
      }

      // 8. UOM Filter
      if (uomFilter) {
        const itemUom = (item.unit || '').toUpperCase();
        const pUom = (p?.uom || '').toUpperCase();
        if (itemUom !== uomFilter.toUpperCase() && pUom !== uomFilter.toUpperCase()) {
          return false;
        }
      }

      // 9. MSL Severity Filter
      if (mslFilter) {
        if (mslFilter === 'OUT_OF_STOCK' && item.severity !== 'OUT_OF_STOCK') return false;
        if (mslFilter === 'CRITICAL' && item.severity !== 'CRITICAL') return false;
        if (mslFilter === 'LOW_STOCK' && item.severity !== 'LOW_STOCK') return false;
        if (
          mslFilter === 'NORMAL' &&
          (item.severity === 'OUT_OF_STOCK' ||
            item.severity === 'CRITICAL' ||
            item.severity === 'LOW_STOCK')
        ) {
          return false;
        }
      }

      // 10. Status Filter (Active / Inactive)
      if (statusFilter === 'ACTIVE' && p && !p.isActive) return false;
      if (statusFilter === 'INACTIVE' && p && p.isActive) return false;

      return true;
    });
  }, [
    exceptions,
    searchQuery,
    selectedCategories,
    selectedFamilies,
    selectedWarehouses,
    selectedLocations,
    selectedRacks,
    selectedBins,
    uomFilter,
    mslFilter,
    statusFilter,
    productsMap,
    productLocationMap,
    famMap,
    categories,
    families,
  ]);

  // Export Columns definition
  const exportMslColumns: ExportColumn<MslException>[] = useMemo(
    () => [
      { header: 'Item / Product Name', key: 'itemName' },
      { header: 'Item Code / SKU', key: 'skuCode' },
      { header: 'Category', key: 'category' },
      { header: 'Current Stock', key: 'currentStock' },
      { header: 'MSL Threshold', key: 'mslThreshold' },
      { header: 'Deficit Qty', key: 'deficit' },
      { header: 'Unit of Measure', key: 'unit' },
      { header: 'Severity Status', key: 'severity' },
    ],
    []
  );

  const handleAdjustStock = (item: MslException) => {
    navigate(`/inventory/movements?mode=STOCK_IN&productId=${encodeURIComponent(item.id)}`);
  };

  const handleViewLedger = (item: MslException) => {
    navigate(`/inventory/stock?tab=LEDGER&product=${encodeURIComponent(item.itemName)}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">MSL Alerts</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Automated real-time threshold monitoring and safety buffer guardrails
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isMslLoading}
            title="Out of Stock"
            value={(stats.outOfStock ?? 0).toString().padStart(2, '0')}
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="Zero Stock / Stockout Risk"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isMslLoading}
            title="Critical Breaches"
            value={stats.critical.toString().padStart(2, '0')}
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="<50% MSL"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isMslLoading}
            title="Low Stock Alerts"
            value={stats.lowStock.toString().padStart(2, '0')}
            icon={<AlertTriangle className="w-5 h-5" />}
            statusLabel="Below MSL Target"
            colorScheme="warning"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            isLoading={isMslLoading}
            title="Inventory Health Index"
            value={`${stats.healthIndex}%`}
            icon={<Activity className="w-5 h-5" />}
            statusLabel="Target: >90.0% Optimal"
            colorScheme="success"
          />
        </div>
      </div>

      <div className="mt-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Live Exceptions
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing {filteredExceptions.length} of {exceptions.length} stock alerts
          </span>
        </div>

        {/* Rich Filter Toolbar matching Stock Overview specification */}
        <MslFilterPanel
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters(!showFilters)}
          activeFilterCount={activeFilterCount}
          onResetAll={handleResetAll}
          onRefresh={handleRefresh}
          isLoading={isMslLoading || isMasterDataLoading}
          exportData={filteredExceptions}
          exportColumns={exportMslColumns}
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoriesChange={setSelectedCategories}
          families={families}
          selectedFamilies={selectedFamilies}
          onFamiliesChange={setSelectedFamilies}
          warehouses={warehouses}
          selectedWarehouses={selectedWarehouses}
          onWarehousesChange={setSelectedWarehouses}
          locations={locations}
          selectedLocations={selectedLocations}
          onLocationsChange={setSelectedLocations}
          racks={racks}
          selectedRacks={selectedRacks}
          onRacksChange={setSelectedRacks}
          bins={bins}
          selectedBins={selectedBins}
          onBinsChange={setSelectedBins}
          uomFilter={uomFilter}
          onUomChange={setUomFilter}
          mslFilter={mslFilter}
          onMslChange={setMslFilter}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />

        <MslExceptionGrid
          data={filteredExceptions}
          isLoading={isMslLoading}
          onAdjustStock={handleAdjustStock}
          onViewLedger={handleViewLedger}
        />
      </div>
    </div>
  );
}
