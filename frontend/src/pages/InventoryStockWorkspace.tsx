import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  SlideOver,
} from '../components/ui';
import type { ColumnDef } from '../components/ui';
import { inventoryService } from '../services/inventoryService';
import type { StockBalance, StockTransaction } from '../services/inventoryService';
import type { StockMovementMode } from './StockMovementWorkspace';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { masterDataService } from '../services/masterDataService';
import type { Product, Category, Family, Warehouse, Location, Rack, Bin } from '../services/masterDataService';
import { Filter, Search, RefreshCw } from 'lucide-react';
const UOM_OPTIONS = ['NOS', 'KGS', 'MTRS', 'LTRS', 'BOX', 'PACK', 'SET', 'ROLL'];



export function InventoryStockWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toUpperCase();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER'>(
    urlTab === 'MOVEMENTS' || urlTab === 'LEDGER' ? 'LEDGER' : 'OVERVIEW'
  );

  useEffect(() => {
    if (urlTab === 'MOVEMENTS' || urlTab === 'LEDGER') {
      setActiveTab('LEDGER');
    } else if (urlTab === 'OVERVIEW') {
      setActiveTab('OVERVIEW');
    }
  }, [urlTab]);
  
  
  // Metadata for filters
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);

  // Filter selections
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [uomFilter, setUomFilter] = useState<string>('');
  const [mslFilter, setMslFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Overview Tab State
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isBalancesLoading, setIsBalancesLoading] = useState(true);
  const [balancesSearch, setBalancesSearch] = useState('');
  
  // SlideOver State for Overview
  const [selectedBalance, setSelectedBalance] = useState<StockBalance | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [balanceTransactions, setBalanceTransactions] = useState<StockTransaction[]>([]);
  const [isBalanceTxLoading, setIsBalanceTxLoading] = useState(false);

  // Ledger Tab State
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');

  const loadData = async () => {
    setIsBalancesLoading(true);
    try {
      const [prodRes, catRes, famRes, whRes, locRes, rackRes, binRes, balRes] = await Promise.all([
        masterDataService.getProducts({ pageSize: 1000 }).catch(() => ({ data: [] })),
        masterDataService.getCategories({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getFamilies({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getWarehouses({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getLocations({ pageSize: 100 }).catch(() => ({ data: [] })),
        masterDataService.getRacks({ pageSize: 1000 }).catch(() => ({ data: [] })),
        masterDataService.getBins({ pageSize: 1000 }).catch(() => ({ data: [] })),
        inventoryService.getAllBalances({ page: 1, pageSize: 2000 }).catch(() => ({ data: [] }))
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
      toast.error('Failed to load stock overview data');
    } finally {
      setIsBalancesLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsTransactionsLoading(true);
    try {
      const res = await inventoryService.getAllTransactions({
        page: txPage,
        pageSize: 50,
        transactionType: txTypeFilter || undefined
      });
      setTransactions(res.data);
    } catch {
      toast.error('Failed to load stock transactions');
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const fetchSelectedBalanceTransactions = async (row: StockBalance) => {
    setIsBalanceTxLoading(true);
    try {
      const res = await inventoryService.getAllTransactions({
        productId: row.productId,
        binId: row.binId,
        page: 1,
        pageSize: 50
      });
      setBalanceTransactions(res.data);
    } catch (err) {
      toast.error('Failed to load transactions for product');
    } finally {
      setIsBalanceTxLoading(false);
    }
  };

  
  useEffect(() => {
    if (activeTab === 'OVERVIEW') {
      if (balances.length === 0) loadData();
    } else {
      fetchTransactions();
    }
  }, [activeTab, txPage, txTypeFilter]);

  // Build maps for fast lookup
  const binMap = new Map(bins.map(b => [b.id, b]));
  const rackMap = new Map(racks.map(r => [r.id, r]));
  const locMap = new Map(locations.map(l => [l.id, l]));
  const famMap = new Map(families.map(f => [f.id, f]));

  // Cascading options
  const filteredFamilyOptions = families.filter((f) => selectedCategories.length === 0 || selectedCategories.includes(f.categoryId));
  const filteredLocationOptions = locations.filter((l) => selectedWarehouses.length === 0 || selectedWarehouses.includes(l.warehouseId));
  
  // All racks in selected locations/warehouses
  const filteredRackOptions = racks.filter((r) => {
    if (selectedLocations.length > 0 && !selectedLocations.includes(r.locationId)) return false;
    if (selectedWarehouses.length > 0) {
      const loc = locMap.get(r.locationId);
      if (!loc || !selectedWarehouses.includes(loc.warehouseId)) return false;
    }
    return true;
  });

  // Only standalone bins (located in Bin/Box storage areas), filtered by rack/location if selected
  const filteredBinOptions = bins.filter((b) => {
    const rack = rackMap.get(b.rackId);
    const loc = rack ? locMap.get(rack.locationId) : null;
    const isStandaloneBinArea = loc && (
      loc.code === 'LOC-BINS' ||
      loc.code === 'LOC-BOXES' ||
      loc.name.toLowerCase().includes('bin') ||
      loc.name.toLowerCase().includes('box')
    );
    if (!isStandaloneBinArea) return false;

    if (selectedRacks.length > 0 && !selectedRacks.includes(b.rackId)) return false;
    if (selectedLocations.length > 0 && rack && !selectedLocations.includes(rack.locationId)) return false;
    if (selectedWarehouses.length > 0 && loc && !selectedWarehouses.includes(loc.warehouseId)) return false;
    return true;
  });

  const filteredBalances = React.useMemo(() => {
    return balances.filter(b => {
      const p = products.find(prod => prod.id === b.productId);
      
      // Search
      if (balancesSearch) {
        const s = balancesSearch.toLowerCase();
        if (
          !b.productCode?.toLowerCase().includes(s) &&
          !b.productName?.toLowerCase().includes(s) &&
          !b.binCode?.toLowerCase().includes(s)
        ) {
          return false;
        }
      }

      // Categories & Families
      if (p) {
        const catId = (p as any).categoryId || p.family?.categoryId || famMap.get(p.familyId)?.categoryId;
        if (selectedCategories.length > 0 && (!catId || !selectedCategories.includes(catId))) return false;
        if (selectedFamilies.length > 0 && !selectedFamilies.includes(p.familyId)) return false;
      } else {
        if (selectedCategories.length > 0 || selectedFamilies.length > 0) return false;
      }

      // Warehouse, Location, Rack, Bin
      if (selectedBins.length > 0 && !selectedBins.includes(b.binId)) return false;
      
      const bin = binMap.get(b.binId);
      if (bin) {
        if (selectedRacks.length > 0 && !selectedRacks.includes(bin.rackId)) return false;
        const rack = rackMap.get(bin.rackId);
        if (rack) {
          if (selectedLocations.length > 0 && !selectedLocations.includes(rack.locationId)) return false;
          const loc = locMap.get(rack.locationId);
          if (loc) {
            if (selectedWarehouses.length > 0 && !selectedWarehouses.includes(loc.warehouseId)) return false;
          }
        }
      } else {
        if (selectedRacks.length > 0 || selectedLocations.length > 0 || selectedWarehouses.length > 0) return false;
      }

      // UOM
      if (uomFilter && b.uom !== uomFilter) return false;

      // MSL
      const mslVal = b.msl ?? 0;
      const diff = b.currentQuantity - mslVal;
      let status = 'OK';
      if (diff < 0) status = 'CRITICAL';
      else if (diff <= 5) status = 'LOW';
      
      if (mslFilter === 'BELOW' && status !== 'CRITICAL') return false;
      if (mslFilter === 'AT' && status !== 'LOW') return false;
      if (mslFilter === 'ABOVE' && status !== 'OK') return false;
      
      // Status
      if (statusFilter === 'ACTIVE' && p && !p.isActive) return false;
      if (statusFilter === 'INACTIVE' && p && p.isActive) return false;

      return true;
    });
  }, [balances, balancesSearch, selectedCategories, selectedFamilies, selectedWarehouses, selectedLocations, selectedRacks, selectedBins, uomFilter, mslFilter, statusFilter, products, binMap, rackMap, locMap]);


  const handleRowClick = async (row: StockBalance) => {
    setSelectedBalance(row);
    setIsSlideOverOpen(true);
    await fetchSelectedBalanceTransactions(row);
  };

  const handleOpenMovement = (mode: StockMovementMode, prodId?: string, binId?: string) => {
    const params = new URLSearchParams({ mode });
    if (prodId) params.set('productId', prodId);
    if (binId) params.set('binId', binId);
    navigate(`/inventory/movements?${params.toString()}`);
  };

  const overviewColumns: ColumnDef<StockBalance>[] = [
        { key: 'productCode', header: 'Code', render: (r) => r.productCode || 'N/A' },
    { key: 'productName', header: 'Product Name', render: (r) => r.productName || 'N/A' },
    { key: 'warehouseLocation', header: 'Warehouse Location', render: (r) => {
        const bin = binMap.get(r.binId);
        let primaryLabel = r.binCode || 'N/A';
        if (bin && bin.rackId) {
          const rack = rackMap.get(bin.rackId);
          if (rack && rack.locationId) {
            const loc = locMap.get(rack.locationId);
            if (loc) {
              const isBinArea = loc.name.toLowerCase().includes('bin');
              if (isBinArea) {
                primaryLabel = bin.code;
              } else {
                primaryLabel = rack.code;
              }
            }
          }
        }
        return <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">{primaryLabel}</span>;
    } },
    { key: 'warehouseName', header: 'Warehouse', render: (r) => r.warehouseName || 'N/A' },
    { key: 'latestLotBatchNumber', header: 'Lot/Batch', render: (r) => r.latestLotBatchNumber || 'N/A' },
    { key: 'currentQuantity', header: 'Qty', isNumeric: true, render: (r) => `${r.currentQuantity} ${r.uom || ''}` },
    { key: 'msl', header: 'MSL', isNumeric: true, render: (r) => r.msl ?? 'N/A' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r) => {
        if (r.msl === undefined || r.msl === null) return <StatusBadge status="OK" />;
        const diff = Number(r.currentQuantity) - Number(r.msl);
        if (diff < 0) return <StatusBadge status="CRITICAL" />;
        if (diff <= 5) return <StatusBadge status="LOW" />;
        return <StatusBadge status="OK" />;
      } 
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Stock In to this Bin"
            onClick={() => handleOpenMovement('STOCK_IN', r.productId, r.binId)}
            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Stock Out from this Bin"
            onClick={() => handleOpenMovement('STOCK_OUT', r.productId, r.binId)}
            className="p-1 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
          >
            <ArrowUpFromLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Adjust Stock in this Bin"
            onClick={() => handleOpenMovement('ADJUST', r.productId, r.binId)}
            className="p-1 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const txColumns: ColumnDef<StockTransaction>[] = [
    { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'product', header: 'Product', render: (r) => r.product?.name || 'N/A' },
    { key: 'bin', header: 'Bin', render: (r) => {
        if (r.sourceBin && r.destinationBin) return `${r.sourceBin.code} → ${r.destinationBin.code}`;
        if (r.sourceBin) return r.sourceBin.code;
        if (r.destinationBin) return r.destinationBin.code;
        return 'N/A';
    }},
    { key: 'transactionType', header: 'Type', render: (r) => <StatusBadge status={r.transactionType} /> },
    { 
      key: 'quantity', 
      header: 'Qty', 
      isNumeric: true,
      render: (r) => {
        const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || r.transactionType === 'GRN_RECEIPT' || r.transactionType === 'DC_RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
        const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || r.transactionType === 'DC_DISPATCH' || r.transactionType === 'PRODUCTION_CONSUMPTION' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
        const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
        const sign = isAddition ? '+' : isSubtraction ? '-' : '';
        return <span className={`font-medium ${color}`}>{sign}{r.quantity} {r.product?.uom || ''}</span>;
      }
    },
    { key: 'lotBatchNumber', header: 'Lot/Batch', render: (r) => r.lotBatchNumber || 'N/A' },
    { key: 'cost', header: 'Cost', isNumeric: true, render: (r) => r.cost != null ? `$${Number(r.cost).toFixed(2)}` : 'N/A' },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || 'N/A' },
    { key: 'createdBy', header: 'Created By', render: (r) => r.createdBy?.name || 'System' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Overview & Ledger"
        subtitle="View current inventory balances, manage physical movements, and audit transactions"
        breadcrumbs={<span>Inventory / Stock Overview</span>}
        actionSlot={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_IN')}
              className="inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Stock In
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_OUT')}
              className="inline-flex items-center px-3 py-1.5 border border-rose-300 text-xs font-medium rounded-md text-rose-800 bg-rose-50 hover:bg-rose-100 transition-colors shadow-sm"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              Stock Out
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('ADJUST')}
              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-800 bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Adjust
            </button>
          </div>
        }
      />

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'OVERVIEW'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'LEDGER'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Movements
          </button>
        </nav>
      </div>

      
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
            {/* Row 1: Search & Actions */}
            <div className="flex justify-between items-center">
              <div className="w-1/2 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search products or bins..."
                  className="pl-10 h-10 w-full rounded-lg border border-slate-300 bg-slate-50 text-sm focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={balancesSearch}
                  onChange={(e) => setBalancesSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadData}
                  disabled={isBalancesLoading}
                  className="h-10 px-3 flex items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 rounded-lg text-slate-600 transition-colors shadow-sm"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isBalancesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Row 2: Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>
              <MultiSelectFilter
                label="Category"
                placeholder="All Categories"
                options={categories.map((c) => ({ id: c.id, label: c.name }))}
                selectedValues={selectedCategories}
                onChange={setSelectedCategories}
              />
              <MultiSelectFilter
                label="Family"
                placeholder="All Families"
                options={filteredFamilyOptions.map((f) => ({ id: f.id, label: f.name, subtext: f.category?.name }))}
                selectedValues={selectedFamilies}
                onChange={setSelectedFamilies}
              />
              <MultiSelectFilter
                label="Warehouse"
                placeholder="All Warehouses"
                options={warehouses.map((w) => ({ id: w.id, label: w.name, subtext: w.code }))}
                selectedValues={selectedWarehouses}
                onChange={setSelectedWarehouses}
              />
              <MultiSelectFilter
                label="Location"
                placeholder="All Locations"
                options={filteredLocationOptions.map((l) => ({ id: l.id, label: l.name, subtext: l.code }))}
                selectedValues={selectedLocations}
                onChange={setSelectedLocations}
              />
              <MultiSelectFilter
                label="Rack"
                placeholder="All Racks"
                options={filteredRackOptions.map((r) => ({ id: r.id, label: r.name, subtext: r.code }))}
                selectedValues={selectedRacks}
                onChange={setSelectedRacks}
              />
              <MultiSelectFilter
                label="Bin"
                placeholder="All Bins"
                options={filteredBinOptions.map((b) => ({ id: b.id, label: b.code, subtext: b.name }))}
                selectedValues={selectedBins}
                onChange={setSelectedBins}
              />
              <select
                value={uomFilter}
                onChange={(e) => setUomFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="">All UOMs</option>
                {UOM_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <select
                value={mslFilter}
                onChange={(e) => setMslFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="">All MSL Monitoring</option>
                <option value="BELOW">Below MSL (Critical)</option>
                <option value="AT">Near MSL (Low)</option>
                <option value="ABOVE">Above MSL (Ok)</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>
          
          <DataTable
            data={filteredBalances}
            columns={overviewColumns}
            isLoading={isBalancesLoading}
            pagination
            defaultPageSize={20}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Physical Stock Movements & Transactions</h3>
            <select
              value={txTypeFilter}
              onChange={(e) => {
                setTxTypeFilter(e.target.value);
                setTxPage(1);
              }}
              className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="">All Movement Types</option>
              <option value="STOCK_IN">Stock In</option>
              <option value="STOCK_OUT">Stock Out</option>
              <option value="TRANSFER">Bin Transfer</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="STORES_ISSUE">Stores RM Issue</option>
              <option value="RETURN">Surplus Return</option>
              <option value="PRODUCTION_CONSUMPTION">Production Consumption</option>
            </select>
          </div>
          <DataTable
            data={transactions}
            columns={txColumns}
            isLoading={isTransactionsLoading}
            pagination
            defaultPageSize={20}
          />
        </div>
      )}


      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={selectedBalance ? `History: ${selectedBalance.productName}` : 'Transaction History'}
      >
        <div className="space-y-6">
          {selectedBalance && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Bin</p>
                  <p className="font-medium">{selectedBalance.binCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Warehouse</p>
                  <p className="font-medium">{selectedBalance.warehouseName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Qty</p>
                  <p className="font-medium">{selectedBalance.currentQuantity} {selectedBalance.uom}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">MSL</p>
                  <p className="font-medium">{selectedBalance.msl ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Latest Lot/Batch</p>
                  <p className="font-medium">{selectedBalance.latestLotBatchNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Transactions</h4>
            <DataTable
              data={balanceTransactions}
              columns={[
                { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
                { key: 'transactionType', header: 'Type', render: (r) => <StatusBadge status={r.transactionType} /> },
                { 
                  key: 'quantity', 
                  header: 'Qty',
                  isNumeric: true,
                  render: (r) => {
                    const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || r.transactionType === 'GRN_RECEIPT' || r.transactionType === 'DC_RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
                    const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || r.transactionType === 'DC_DISPATCH' || r.transactionType === 'PRODUCTION_CONSUMPTION' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
                    const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
                    const sign = isAddition ? '+' : isSubtraction ? '-' : '';
                    return <span className={`font-medium ${color}`}>{sign}{r.quantity}</span>;
                  }
                },
                { key: 'lotBatchNumber', header: 'Lot/Batch', render: (r) => r.lotBatchNumber || 'N/A' }
              ]}
              isLoading={isBalanceTxLoading}
            />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
