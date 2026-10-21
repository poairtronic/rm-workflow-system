import React, { useState, useEffect, useMemo } from 'react';
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
  Truck,
  X,
  Barcode,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { MultiSelectFilter } from '../components/ui/MultiSelectFilter';
import { masterDataService } from '../services/masterDataService';
import type { Product, Category, Family, Warehouse, Location, Rack, Bin } from '../services/masterDataService';
import { Filter, Search, RefreshCw, ChevronDown, RotateCcw } from 'lucide-react';
import { DcMovementsWorkspaceView } from '../components/dispatch/DcMovementsWorkspaceView';
import { triggerBarcodeScanner } from '../hooks/useBarcodeScanner';
import { ExportDropdown } from '../components/common/ExportDropdown';
import type { ExportColumn } from '../utils/exportUtils';
const UOM_OPTIONS = ['MM', 'NOS', 'PC', 'KG', 'KGS', 'MTRS', 'LTRS', 'BOX', 'PACK', 'SET', 'ROLL'];

export function InventoryStockWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toUpperCase();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER' | 'DC_MOVEMENTS'>(
    urlTab === 'DC_MOVEMENTS' || urlTab === 'DC'
      ? 'DC_MOVEMENTS'
      : urlTab === 'MOVEMENTS' || urlTab === 'LEDGER'
      ? 'LEDGER'
      : 'OVERVIEW'
  );

  useEffect(() => {
    if (urlTab === 'DC_MOVEMENTS' || urlTab === 'DC') {
      setActiveTab('DC_MOVEMENTS');
    } else if (urlTab === 'MOVEMENTS' || urlTab === 'LEDGER') {
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
  const [showFilters, setShowFilters] = useState(false);

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
  }, [selectedCategories, selectedFamilies, selectedWarehouses, selectedLocations, selectedRacks, selectedBins, uomFilter, mslFilter, statusFilter]);

  const resetAllFilters = () => {
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
  const [txSearch, setTxSearch] = useState('');

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
        pageSize: 100,
        transactionType: txTypeFilter || undefined,
        search: txSearch.trim() || undefined,
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

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t: any) => {
      const pName = (t.product?.name || '').toLowerCase();
      const pCode = (t.product?.code || '').toLowerCase();
      const sBin = (t.sourceBin?.code || '').toLowerCase();
      const dBin = (t.destinationBin?.code || '').toLowerCase();
      const batch = (t.lotBatchNumber || '').toLowerCase();
      const reason = (t.reason || '').toLowerCase();
      const remarks = (t.remarks || '').toLowerCase();
      const by = (t.createdBy?.name || '').toLowerCase();
      return (
        pName.includes(q) ||
        pCode.includes(q) ||
        sBin.includes(q) ||
        dBin.includes(q) ||
        batch.includes(q) ||
        reason.includes(q) ||
        remarks.includes(q) ||
        by.includes(q)
      );
    });
  }, [transactions, txSearch]);

  useEffect(() => {
    if (activeTab === 'OVERVIEW') {
      if (balances.length === 0) loadData();
    } else if (activeTab === 'LEDGER') {
      fetchTransactions();
    }
  }, [activeTab, txPage, txTypeFilter, txSearch]);

  // Auto-refresh when fast barcode scan transactions are processed
  useEffect(() => {
    const handleUpdate = () => {
      loadData();
      if (activeTab === 'LEDGER') fetchTransactions();
    };
    window.addEventListener('inventory-updated', handleUpdate);
    return () => window.removeEventListener('inventory-updated', handleUpdate);
  }, [activeTab]);

  // Build maps for fast lookup
  const binMap = new Map(bins.map(b => [b.id, b]));
  const rackMap = new Map(racks.map(r => [r.id, r]));
  const locMap = new Map(locations.map(l => [l.id, l]));
  const famMap = new Map(families.map(f => [f.id, f]));

  // Cascading options
  const filteredFamilyOptions = families.filter((f) => selectedCategories.length === 0 || selectedCategories.includes(f.categoryId));
  const filteredLocationOptions = locations.filter((l) => selectedWarehouses.length === 0 || selectedWarehouses.includes(l.warehouseId));
  
  // All racks in selected locations/warehouses (excluding placeholder shelving and bins)
  const filteredRackOptions = racks.filter((r) => {
    if (r.code.startsWith('BIN-') || r.code.startsWith('BIN ')) return false;
    if (selectedLocations.length > 0 && !selectedLocations.includes(r.locationId)) return false;
    if (selectedWarehouses.length > 0) {
      const loc = locMap.get(r.locationId);
      if (!loc || !selectedWarehouses.includes(loc.warehouseId)) return false;
    }
    return true;
  });

  // All bins in Bin Area (or standalone box/bin storage units)
  const filteredBinOptions = bins.filter((b) => {
    const rack = rackMap.get(b.rackId);
    const loc = rack ? locMap.get(rack.locationId) : null;
    const isBinStorage = (
      b.code.startsWith('BIN') ||
      b.code.startsWith('BOX') ||
      b.code === 'BLUE BOX' ||
      b.code === 'NONE' ||
      (loc && (
        loc.code === 'BIN-AREA' ||
        loc.code === 'LOC-BINS' ||
        loc.name.toLowerCase().includes('bin') ||
        loc.name.toLowerCase().includes('box')
      ))
    );
    if (!isBinStorage) return false;

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
      const bin = binMap.get(b.binId);
      const bLocationId = (b as any).locationId || (bin?.rackId ? rackMap.get(bin.rackId)?.locationId : null);
      const bRackId = (b as any).rackId || bin?.rackId;
      const bWarehouseId = (b as any).warehouseId || (bLocationId ? locMap.get(bLocationId)?.warehouseId : null);

      if (selectedBins.length > 0 && !selectedBins.includes(b.binId)) return false;
      if (selectedRacks.length > 0 && (!bRackId || !selectedRacks.includes(bRackId))) return false;
      if (selectedLocations.length > 0 && (!bLocationId || !selectedLocations.includes(bLocationId))) return false;
      if (selectedWarehouses.length > 0 && (!bWarehouseId || !selectedWarehouses.includes(bWarehouseId))) return false;

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
        let locLabel = (r as any).locationName || '';
        if (bin && bin.rackId) {
          const rack = rackMap.get(bin.rackId);
          if (rack && rack.locationId) {
            const loc = locMap.get(rack.locationId);
            if (loc) {
              locLabel = loc.name;
              const isBinArea = loc.name.toLowerCase().includes('bin');
              if (isBinArea) {
                primaryLabel = bin.code;
              } else {
                primaryLabel = rack.code;
              }
            }
          }
        }
        return (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 w-fit">{primaryLabel}</span>
            {locLabel && <span className="text-[10px] text-slate-400 font-medium">{locLabel}</span>}
          </div>
        );
    } },
    { key: 'warehouseName', header: 'Warehouse', render: (r) => r.warehouseName || 'N/A' },
    { key: 'latestLotBatchNumber', header: 'Lot/Batch', render: (r) => r.latestLotBatchNumber || 'N/A' },
    { 
      key: 'currentQuantity', 
      header: 'Qty', 
      isNumeric: true, 
      render: (r) => {
        const val = Number(r.currentQuantity);
        if (val < 0) {
          return (
            <span className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
              {r.currentQuantity} {r.uom || ''}
            </span>
          );
        }
        return `${r.currentQuantity} ${r.uom || ''}`;
      } 
    },
    { key: 'msl', header: 'MSL', isNumeric: true, render: (r) => r.msl ?? 'N/A' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r) => {
        const val = Number(r.currentQuantity);
        if (val < 0) {
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white shadow-xs">
              DEFICIT
            </span>
          );
        }
        if (r.msl === undefined || r.msl === null) return <StatusBadge status="OK" />;
        const diff = val - Number(r.msl);
        if (diff < 0) return <StatusBadge status="CRITICAL" />;
        if (diff <= 5) return <StatusBadge status="LOW" />;
        return <StatusBadge status="OK" />;
      } 
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Stock In to this Bin"
            onClick={() => handleOpenMovement('STOCK_IN', r.productId, r.binId)}
            className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 transition-colors flex items-center justify-center cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Stock Out from this Bin"
            onClick={() => handleOpenMovement('STOCK_OUT', r.productId, r.binId)}
            className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 transition-colors flex items-center justify-center cursor-pointer"
          >
            <ArrowUpFromLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Adjust Stock in this Bin"
            onClick={() => handleOpenMovement('ADJUST', r.productId, r.binId)}
            className="min-h-[36px] min-w-[36px] p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 transition-colors flex items-center justify-center cursor-pointer"
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

  const exportOverviewColumns: ExportColumn<StockBalance>[] = [
    { header: 'Code', accessor: (r) => r.productCode || 'N/A' },
    { header: 'Product Name', accessor: (r) => r.productName || 'N/A' },
    {
      header: 'Warehouse Location',
      accessor: (r) => {
        const bin = binMap.get(r.binId);
        let primaryLabel = r.binCode || 'N/A';
        let locLabel = (r as any).locationName || '';
        if (bin && bin.rackId) {
          const rack = rackMap.get(bin.rackId);
          if (rack && rack.locationId) {
            const loc = locMap.get(rack.locationId);
            if (loc) {
              locLabel = loc.name;
              primaryLabel = loc.name.toLowerCase().includes('bin') ? bin.code : rack.code;
            }
          }
        }
        return locLabel ? `${primaryLabel} (${locLabel})` : primaryLabel;
      },
    },
    { header: 'Warehouse', accessor: (r) => r.warehouseName || 'N/A' },
    { header: 'Lot/Batch', accessor: (r) => r.latestLotBatchNumber || 'N/A' },
    {
      header: 'Qty',
      isNumeric: true,
      accessor: (r) => `${r.currentQuantity} ${r.uom || ''}`,
    },
    { header: 'MSL', isNumeric: true, accessor: (r) => r.msl ?? 'N/A' },
    {
      header: 'Status',
      accessor: (r) => {
        const val = Number(r.currentQuantity);
        if (val < 0) return 'DEFICIT';
        if (r.msl === undefined || r.msl === null) return 'OK';
        const diff = val - Number(r.msl);
        if (diff < 0) return 'CRITICAL';
        if (diff <= 5) return 'LOW';
        return 'OK';
      },
    },
  ];

  const exportTxColumns: ExportColumn<StockTransaction>[] = [
    {
      header: 'Date',
      accessor: (r) => new Date(r.createdAt).toLocaleString('en-IN'),
    },
    { header: 'Product', accessor: (r) => r.product?.name || 'N/A' },
    { header: 'Product Code', accessor: (r) => r.product?.code || 'N/A' },
    {
      header: 'Bin',
      accessor: (r) => {
        if (r.sourceBin && r.destinationBin) return `${r.sourceBin.code} → ${r.destinationBin.code}`;
        if (r.sourceBin) return r.sourceBin.code;
        if (r.destinationBin) return r.destinationBin.code;
        return 'N/A';
      },
    },
    { header: 'Type', accessor: (r) => r.transactionType },
    {
      header: 'Qty',
      isNumeric: true,
      accessor: (r) => {
        const isAddition =
          r.transactionType === 'STOCK_IN' ||
          r.transactionType === 'RETURN' ||
          r.transactionType === 'GRN_RECEIPT' ||
          r.transactionType === 'DC_RETURN' ||
          (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
        const isSubtraction =
          r.transactionType === 'STOCK_OUT' ||
          r.transactionType === 'STORES_ISSUE' ||
          r.transactionType === 'DC_DISPATCH' ||
          r.transactionType === 'PRODUCTION_CONSUMPTION' ||
          (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
        const sign = isAddition ? '+' : isSubtraction ? '-' : '';
        return `${sign}${r.quantity} ${r.product?.uom || ''}`;
      },
    },
    { header: 'Lot/Batch', accessor: (r) => r.lotBatchNumber || 'N/A' },
    { header: 'Cost', isNumeric: true, accessor: (r) => (r.cost != null ? `$${Number(r.cost).toFixed(2)}` : 'N/A') },
    { header: 'Reason', accessor: (r) => r.reason || 'N/A' },
    { header: 'Created By', accessor: (r) => r.createdBy?.name || 'System' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      <PageHeader
        title="Stock Overview & Ledger"
        subtitle="View current inventory balances, manage physical movements, and audit transactions"
        breadcrumbs={<span>Inventory / Stock Overview</span>}
        actionSlot={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
            <button
              type="button"
              onClick={() => triggerBarcodeScanner()}
              className="min-h-[44px] h-11 px-3 sm:px-3.5 border border-blue-300 dark:border-blue-800 text-xs font-semibold rounded-xl text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-2xs cursor-pointer group flex items-center shrink-0"
              title="Hardware Barcode Scanner (Press F2 anywhere)"
            >
              <Barcode className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
              Quick Scan
              <kbd className="ml-1.5 px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-[#121526] rounded border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                F2
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_IN')}
              className="min-h-[44px] h-11 px-3 sm:px-3.5 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold rounded-xl text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors shadow-xs flex items-center shrink-0 cursor-pointer"
            >
              <ArrowDownToLine className="w-4 h-4 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              Stock In
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_OUT')}
              className="min-h-[44px] h-11 px-3 sm:px-3.5 border border-rose-300 dark:border-rose-800 text-xs font-semibold rounded-xl text-rose-800 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors shadow-xs flex items-center shrink-0 cursor-pointer"
            >
              <ArrowUpFromLine className="w-4 h-4 mr-1.5 text-rose-600 dark:text-rose-400" />
              Stock Out
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('ADJUST')}
              className="min-h-[44px] h-11 px-3 sm:px-3.5 border border-blue-300 dark:border-blue-800 text-xs font-semibold rounded-xl text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors shadow-xs flex items-center shrink-0 cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 mr-1.5 text-blue-600 dark:text-blue-400" />
              Adjust
            </button>
          </div>
        }
      />

      {/* Responsive Tabs Navigation */}
      <div className="border-b border-gray-200 dark:border-[#1e233d]">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto touch-pan-x no-scrollbar pb-1" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`
              whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-h-[44px] flex items-center cursor-pointer shrink-0
              ${activeTab === 'OVERVIEW'
                ? 'border-primary text-primary dark:text-indigo-400 dark:border-indigo-500 font-bold'
                : 'border-transparent text-gray-500 dark:text-[#8896ab] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
              }
            `}
          >
            Stock Overview
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`
              whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-h-[44px] flex items-center cursor-pointer shrink-0
              ${activeTab === 'LEDGER'
                ? 'border-primary text-primary dark:text-indigo-400 dark:border-indigo-500 font-bold'
                : 'border-transparent text-gray-500 dark:text-[#8896ab] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
              }
            `}
          >
            Normal Stock Movements
          </button>
          <button
            onClick={() => setActiveTab('DC_MOVEMENTS')}
            className={`
              whitespace-nowrap py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm min-h-[44px] flex items-center gap-1.5 sm:gap-2 cursor-pointer shrink-0
              ${activeTab === 'DC_MOVEMENTS'
                ? 'border-primary text-primary dark:text-indigo-400 dark:border-indigo-500 font-bold'
                : 'border-transparent text-gray-500 dark:text-[#8896ab] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
              }
            `}
          >
            <Truck className="w-4 h-4" />
            DC Movement
          </button>
        </nav>
      </div>

      
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 bg-white dark:bg-[#121526] p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-[#1e233d]">
            {/* Row 1: Search & Primary Actions Stacked Cleanly on Mobile */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search products, codes, or bins..."
                  className="pl-10 pr-3 h-11 w-full rounded-xl border border-slate-300 dark:border-[#1e233d] bg-slate-50 dark:bg-[#0e111f] text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-[#121526] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium"
                  value={balancesSearch}
                  onChange={(e) => setBalancesSearch(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
                {/* Secondary Filters Collapsible Toggle */}
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`min-h-[44px] h-11 px-3.5 flex items-center gap-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    activeFilterCount > 0 || showFilters
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#161a2e]'
                  }`}
                  title="Toggle Advanced Filters"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>

                <ExportDropdown
                  data={filteredBalances}
                  columns={exportOverviewColumns}
                  fileName="Stock_Overview"
                  reportTitle="Inventory Stock Overview"
                  reportSubtitle={`Showing ${filteredBalances.length} stock balance records`}
                  metadata={{
                    'Total Items': filteredBalances.length,
                    Search: balancesSearch || 'All',
                    'UOM Filter': uomFilter || 'All',
                    'MSL Filter': mslFilter || 'All',
                    'Status Filter': statusFilter || 'All',
                  }}
                />

                <button
                  type="button"
                  onClick={loadData}
                  disabled={isBalancesLoading}
                  className="min-h-[44px] h-11 px-3.5 flex items-center justify-center border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] hover:bg-slate-50 dark:hover:bg-[#161a2e] rounded-xl text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer shrink-0"
                  title="Refresh data"
                >
                  <RefreshCw className={`w-4 h-4 ${isBalancesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Row 2: Collapsible Secondary Filter Panel */}
            {showFilters && (
              <div className="pt-3 border-t border-slate-100 dark:border-[#1e233d] space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8896ab]">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Filter Attributes:</span>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset All ({activeFilterCount})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
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
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <select
                    value={uomFilter}
                    onChange={(e) => setUomFilter(e.target.value)}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="">All UOMs</option>
                    {UOM_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <select
                    value={mslFilter}
                    onChange={(e) => setMslFilter(e.target.value)}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="">All MSL Monitoring</option>
                    <option value="BELOW">Below MSL (Critical)</option>
                    <option value="AT">Near MSL (Low)</option>
                    <option value="ABOVE">Above MSL (Ok)</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
                  >
                    <option value="">All Status</option>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
            )}
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
        <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
            {/* Real-Time Search Bar */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => {
                  setTxSearch(e.target.value);
                  setTxPage(1);
                }}
                placeholder="Search normal movements (product, bin, batch, reason)..."
                className="w-full pl-10 pr-9 h-11 bg-slate-50 dark:bg-[#0e111f] border border-slate-200 dark:border-[#1e233d] rounded-xl text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#121526] transition-all font-medium"
              />
              {txSearch && (
                <button
                  type="button"
                  onClick={() => setTxSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter and Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
              <select
                value={txTypeFilter}
                onChange={(e) => {
                  setTxTypeFilter(e.target.value);
                  setTxPage(1);
                }}
                className="min-h-[44px] h-11 px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium flex-1 sm:flex-none"
              >
                <option value="">All Movement Types</option>
                <option value="STOCK_IN">Stock In</option>
                <option value="STOCK_OUT">Stock Out</option>
                <option value="TRANSFER">Bin Transfer</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="STORES_ISSUE">Stores RM Issue (RM to Production)</option>
                <option value="RETURN">Surplus Return (Production to Stores)</option>
                <option value="PRODUCTION_CONSUMPTION">Production Consumption</option>
                <option value="DC_DISPATCH">DC Outward (Dispatch - Type 2)</option>
                <option value="DC_RETURN">DC Inward (Return - Type 2)</option>
              </select>

              <ExportDropdown
                data={filteredTransactions}
                columns={exportTxColumns}
                fileName="Normal_Stock_Movements"
                reportTitle="Normal Stock Movements Ledger"
                reportSubtitle={`Showing ${filteredTransactions.length} movement transactions`}
                metadata={{
                  'Total Transactions': filteredTransactions.length,
                  'Movement Type': txTypeFilter || 'All Types',
                  Search: txSearch || 'All',
                }}
              />

              <button
                type="button"
                onClick={fetchTransactions}
                disabled={isTransactionsLoading}
                className="min-h-[44px] h-11 px-3.5 flex items-center justify-center border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] hover:bg-slate-50 dark:hover:bg-[#161a2e] rounded-xl text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer shrink-0"
                title="Refresh transactions"
              >
                <RefreshCw className={`w-4 h-4 ${isTransactionsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <DataTable
            data={filteredTransactions}
            columns={txColumns}
            isLoading={isTransactionsLoading}
            pagination
            defaultPageSize={20}
          />
        </div>
      )}

      {activeTab === 'DC_MOVEMENTS' && (
        <DcMovementsWorkspaceView />
      )}


      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={selectedBalance ? `History: ${selectedBalance.productName}` : 'Transaction History'}
      >
        <div className="space-y-6">
          {selectedBalance && (
            <div className="bg-gray-50 dark:bg-[#0e111f] p-4 rounded-xl border border-slate-200 dark:border-[#1e233d]">
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <p className="text-xs text-slate-500 dark:text-[#8896ab]">Bin</p>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedBalance.binCode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-[#8896ab]">Warehouse</p>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedBalance.warehouseName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-[#8896ab]">Current Qty</p>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedBalance.currentQuantity} {selectedBalance.uom}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-[#8896ab]">MSL</p>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedBalance.msl ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-[#8896ab]">Latest Lot/Batch</p>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{selectedBalance.latestLotBatchNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 sm:mt-6">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white mb-3">Recent Transactions</h4>
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
