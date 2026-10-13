import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  ArrowLeftRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  FormField,
  SearchSelect,
  NumberInput,
  Select,
  Textarea,
  Button,
  TextInput,
  ConfirmDialog,
  type SearchSelectOption
} from '../components/ui';
import {
  inventoryService,
  type ProductBinBalance
} from '../services/inventoryService';
import { masterDataService, type Product, type Bin } from '../services/masterDataService';
import { useQueryClient } from '@tanstack/react-query';

export type StockMovementMode = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUST';
export type AdjustmentSubOption = 'NORMAL' | 'TRANSFER';

export const UOM_OPTIONS = ['MM', 'KG', 'NOS', 'MTR', 'PC', 'SQM', 'LTR'] as const;

export function StockMovementWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlMode = (searchParams.get('mode') as StockMovementMode) || 'STOCK_IN';
  const urlProductId = searchParams.get('productId') || '';
  const urlBinId = searchParams.get('binId') || '';
  const urlAdjustType = (searchParams.get('type') as AdjustmentSubOption) || 'NORMAL';

  const [mode, setMode] = useState<StockMovementMode>(urlMode);
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentSubOption>(urlAdjustType);

  const [productId, setProductId] = useState<string>(urlProductId);
  const [binId, setBinId] = useState<string>(urlBinId); // For STOCK_IN, STOCK_OUT, and NORMAL adjust
  const [sourceBinId, setSourceBinId] = useState<string>(''); // For TRANSFER
  const [targetBinId, setTargetBinId] = useState<string>(''); // For TRANSFER
  const [quantity, setQuantity] = useState<string>('');
  const [selectedUom, setSelectedUom] = useState<string>('KG');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [reason, setReason] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [lotBatchNumber, setLotBatchNumber] = useState<string>('');
  const [cost, setCost] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [productBalances, setProductBalances] = useState<ProductBinBalance[]>([]);

  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Negative balance confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: null,
    action: async () => {},
  });

  // Sync mode changes with URL
  const handleModeChange = (newMode: StockMovementMode) => {
    setMode(newMode);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('mode', newMode);
      return p;
    });
    setQuantity('');
    if (newMode === 'STOCK_OUT') {
      setDirection('DECREASE');
    } else {
      setDirection('INCREASE');
    }
  };

  const handleAdjustmentTypeChange = (newType: AdjustmentSubOption) => {
    setAdjustmentType(newType);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('type', newType);
      return p;
    });

    if (newType === 'TRANSFER' && productBalances.length > 0) {
      // Auto-select source bin with available positive stock
      const positive = productBalances.filter(b => Number(b.currentQuantity) > 0);
      if (positive.length > 0) {
        const sorted = [...positive].sort((a, b) => Number(b.currentQuantity) - Number(a.currentQuantity));
        const best = sorted[0];
        setSourceBinId(best.binId);
        setQuantity(String(best.currentQuantity));
      }
    }
  };

  // Load master products and bins on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingMaster(true);

    Promise.all([
      masterDataService.getProducts({ pageSize: 1000 }),
      masterDataService.getBins({ pageSize: 1000 })
    ])
      .then(([productsRes, binsRes]) => {
        if (!isMounted) return;
        setProducts(productsRes.data || []);
        setAllBins((binsRes.data || []).filter(b => b.isActive));
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error('Failed to load products and bins catalog');
      })
      .finally(() => {
        if (isMounted) setIsLoadingMaster(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync when searchParams change externally
  useEffect(() => {
    if (urlMode) setMode(urlMode);
    if (urlProductId) setProductId(urlProductId);
    if (urlBinId) setBinId(urlBinId);
  }, [urlMode, urlProductId, urlBinId]);

  // Fetch balances when productId changes
  useEffect(() => {
    if (!productId) {
      setProductBalances([]);
      return;
    }

    let isMounted = true;
    setIsLoadingBalances(true);

    inventoryService
      .getBalancesByProduct(productId)
      .then(res => {
        if (!isMounted) return;
        const balances = res || [];
        setProductBalances(balances);

        // Auto-select Source Bin when in TRANSFER mode
        if (mode === 'ADJUST' && adjustmentType === 'TRANSFER') {
          const positive = balances.filter(b => Number(b.currentQuantity) > 0);
          if (positive.length > 0) {
            const sorted = [...positive].sort((a, b) => Number(b.currentQuantity) - Number(a.currentQuantity));
            const best = sorted[0];
            setSourceBinId(best.binId);
            setQuantity(String(best.currentQuantity));
          }
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setProductBalances([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingBalances(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, mode, adjustmentType]);

  useEffect(() => {
    if (productId && products.length > 0) {
      const prod = products.find(p => p.id === productId);
      if (prod?.uom) {
        setSelectedUom(prod.uom.toUpperCase());
      }
    }
  }, [productId, products]);

  const selectedProduct = products.find(p => p.id === productId);
  const uom = selectedUom;

  // Helper to format bin labels and location hierarchy
  const getBinHierarchy = (id: string) => {
    const bin = allBins.find(b => b.id === id);
    if (!bin) return { code: 'N/A', rack: 'N/A', location: 'N/A', warehouse: 'N/A' };
    return {
      code: bin.code,
      rack: bin.rack?.code || 'N/A',
      location: bin.rack?.location?.name || 'N/A',
      warehouse: bin.rack?.location?.warehouse?.name || 'N/A'
    };
  };

  // Compute available balance in selected bin (for NORMAL adjust / STOCK_OUT)
  const selectedBinBalance = productBalances.find(b => b.binId === binId);
  const availableBalance = selectedBinBalance ? Number(selectedBinBalance.currentQuantity) : 0;

  // Options for product SearchSelect
  const productOptions: SearchSelectOption[] = products.map(p => ({
    id: p.id,
    primary: p.name,
    secondary: `${p.code ? `${p.code} • ` : ''}${p.uom || 'KG'}${p.minimumInventory ? ` (MSL: ${p.minimumInventory})` : ''}`
  }));

  // Options for Single Bin SearchSelect (Stock In / Stock Out / Normal Adjust)
  let singleBinOptions: SearchSelectOption[] = [];
  const isDeduction = mode === 'STOCK_OUT';

  if (isDeduction) {
    singleBinOptions = productBalances
      .filter(b => Number(b.currentQuantity) > 0)
      .map(b => {
        const bin = allBins.find(ab => ab.id === b.binId);
        let primaryLabel = b.binCode || 'Bin';
        if (bin?.rack?.location) {
          const locName = bin.rack.location.name.toLowerCase();
          primaryLabel = locName.includes('bin') ? bin.code : bin.rack.code;
        }
        return {
          id: b.binId,
          primary: primaryLabel,
          secondary: `Available: ${b.currentQuantity} ${uom} • ${b.warehouseName || 'Warehouse'}`
        };
      });
  } else {
    singleBinOptions = allBins.map(b => {
      const match = productBalances.find(pb => pb.binId === b.id);
      const currentQty = match ? Number(match.currentQuantity) : 0;
      let primaryLabel = b.code;
      if (b.rack?.location) {
        const locName = b.rack.location.name.toLowerCase();
        primaryLabel = locName.includes('bin') ? b.code : b.rack.code;
      }
      return {
        id: b.id,
        primary: primaryLabel,
        secondary: `${b.name || ''} • Current: ${currentQty} ${uom}${b.rack ? ` • Rack ${b.rack.code}` : ''}`
      };
    });
  }

  // Options for TRANSFER: Source Bin
  const sourceBinOptions: SearchSelectOption[] = allBins.map(b => {
    const match = productBalances.find(pb => pb.binId === b.id);
    const currentQty = match ? Number(match.currentQuantity) : 0;
    let primaryLabel = b.code;
    if (b.rack?.location) {
      const locName = b.rack.location.name.toLowerCase();
      primaryLabel = locName.includes('bin') ? b.code : b.rack.code;
    }
    return {
      id: b.id,
      primary: primaryLabel,
      secondary: `Available: ${currentQty} ${uom} • Rack: ${b.rack?.code || 'N/A'}${b.rack?.location ? ` • ${b.rack.location.name}` : ''}`
    };
  });

  // Options for TRANSFER: Target Bin (exclude selected source bin)
  const targetBinOptions: SearchSelectOption[] = allBins
    .filter(b => b.id !== sourceBinId)
    .map(b => {
      const match = productBalances.find(pb => pb.binId === b.id);
      const currentQty = match ? Number(match.currentQuantity) : 0;
      let primaryLabel = b.code;
      if (b.rack?.location) {
        const locName = b.rack.location.name.toLowerCase();
        primaryLabel = locName.includes('bin') ? b.code : b.rack.code;
      }
      return {
        id: b.id,
        primary: primaryLabel,
        secondary: `Current: ${currentQty} ${uom} • Rack: ${b.rack?.code || 'N/A'}${b.rack?.location ? ` • ${b.rack.location.name}` : ''}`
      };
    });

  const numQty = parseFloat(quantity);
  const isQtyValid = !isNaN(numQty) && numQty > 0;
  const isStockOutExceeded = mode === 'STOCK_OUT' && isQtyValid && numQty > availableBalance;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 3;

  // Calculation for Normal Adjustment
  const normalProjectedBalance =
    direction === 'INCREASE' ? availableBalance + (isQtyValid ? numQty : 0) : availableBalance - (isQtyValid ? numQty : 0);
  const isNormalDeficit = mode === 'ADJUST' && adjustmentType === 'NORMAL' && direction === 'DECREASE' && normalProjectedBalance < 0;

  // Calculation for Transfer (Dual-Bin)
  const sourceBalanceEntry = productBalances.find(b => b.binId === sourceBinId);
  const sourceCurrentQty = sourceBalanceEntry ? Number(sourceBalanceEntry.currentQuantity) : 0;
  const projectedSourceQty = sourceCurrentQty - (isQtyValid ? numQty : 0);
  const isTransferSourceDeficit = mode === 'ADJUST' && adjustmentType === 'TRANSFER' && projectedSourceQty < 0;

  const targetBalanceEntry = productBalances.find(b => b.binId === targetBinId);
  const targetCurrentQty = targetBalanceEntry ? Number(targetBalanceEntry.currentQuantity) : 0;
  const projectedTargetQty = targetCurrentQty + (isQtyValid ? numQty : 0);

  // Form validity
  const isTransferMode = mode === 'ADJUST' && adjustmentType === 'TRANSFER';
  const isTransferValid =
    isTransferMode &&
    !!productId &&
    !!sourceBinId &&
    !!targetBinId &&
    sourceBinId !== targetBinId &&
    isQtyValid &&
    isReasonValid &&
    !isSubmitting;

  const isStandardValid =
    !isTransferMode &&
    !!productId &&
    !!binId &&
    isQtyValid &&
    !isStockOutExceeded &&
    isReasonValid &&
    !isSubmitting;

  const isFormValid = isTransferMode ? isTransferValid : isStandardValid;

  // Perform API submission for Normal Adjust / Stock In / Stock Out
  const executeStandardAdjustment = async (allowNegative = false) => {
    setIsSubmitting(true);
    try {
      if (selectedProduct && selectedProduct.uom?.toUpperCase() !== selectedUom) {
        masterDataService.updateProduct(productId, { uom: selectedUom }).catch(() => {});
      }

      const parsedCost = cost ? parseFloat(cost) : undefined;
      const apiPayload = {
        productId,
        binId,
        quantity: numQty,
        reason: trimmedReason,
        remarks: remarks.trim() || undefined,
        lotBatchNumber: lotBatchNumber.trim() || undefined,
        cost: parsedCost
      };

      if (mode === 'STOCK_IN') {
        await inventoryService.stockIn(apiPayload);
        toast.success(`Successfully stocked in ${numQty} ${uom}`);
      } else if (mode === 'STOCK_OUT') {
        await inventoryService.stockOut(apiPayload);
        toast.success(`Successfully stocked out ${numQty} ${uom}`);
      } else if (mode === 'ADJUST') {
        await inventoryService.adjustStock({
          ...apiPayload,
          direction,
          allowNegative
        });
        toast.success(
          `Successfully adjusted stock (${direction === 'INCREASE' ? '+' : '-'}${numQty} ${uom})`
        );
      }

      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMslStatus'] });
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Perform API submission for Bin Movement / Transfer
  const executeTransfer = async (allowNegative = false) => {
    setIsSubmitting(true);
    try {
      if (selectedProduct && selectedProduct.uom?.toUpperCase() !== selectedUom) {
        masterDataService.updateProduct(productId, { uom: selectedUom }).catch(() => {});
      }

      const parsedCost = cost ? parseFloat(cost) : undefined;
      const sourceBinInfo = getBinHierarchy(sourceBinId);
      const targetBinInfo = getBinHierarchy(targetBinId);

      await inventoryService.transferStock({
        productId,
        sourceBinId,
        targetBinId,
        quantity: numQty,
        reason: trimmedReason,
        remarks: remarks.trim() || undefined,
        lotBatchNumber: lotBatchNumber.trim() || undefined,
        cost: parsedCost,
        allowNegative
      });

      toast.success(
        `Successfully transferred ${numQty} ${uom} from ${sourceBinInfo.code} to ${targetBinInfo.code}${
          allowNegative && projectedSourceQty < 0 ? ` (Source balance: ${projectedSourceQty} ${uom})` : ''
        }`
      );

      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMslStatus'] });
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Stock transfer failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    if (isTransferMode) {
      // Check if source bin will be in negative or deficit
      if (isTransferSourceDeficit) {
        const sourceInfo = getBinHierarchy(sourceBinId);
        const targetInfo = getBinHierarchy(targetBinId);

        setConfirmDialog({
          isOpen: true,
          title: 'Negative Stock Balance Warning',
          message: (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                You are about to transfer <span className="font-bold text-red-600">{numQty} {uom}</span> from source bin{' '}
                <span className="font-bold text-slate-900 dark:text-white">{sourceInfo.code}</span> to target bin{' '}
                <span className="font-bold text-slate-900 dark:text-white">{targetInfo.code}</span>.
              </p>
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 space-y-1">
                <div className="flex justify-between">
                  <span>Source Bin Location:</span>
                  <span className="font-semibold">{sourceInfo.code} (Rack: {sourceInfo.rack}, Area: {sourceInfo.location})</span>
                </div>
                <div className="flex justify-between">
                  <span>Current Available Stock:</span>
                  <span className="font-semibold">{sourceCurrentQty} {uom}</span>
                </div>
                <div className="flex justify-between text-red-700 dark:text-red-400 font-bold">
                  <span>Projected Stock in Bin {sourceInfo.code}:</span>
                  <span>{projectedSourceQty} {uom} (DEFICIT)</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold pt-1 border-t border-red-200 dark:border-red-800">
                  <span>Target Bin {targetInfo.code} will receive:</span>
                  <span>+{numQty} {uom}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to proceed and record a negative inventory balance of{' '}
                <span className="font-bold text-red-600">{projectedSourceQty} {uom}</span> in this bin?
              </p>
            </div>
          ),
          action: () => executeTransfer(true)
        });
        return;
      }

      // Normal positive transfer
      await executeTransfer(false);
    } else {
      // Normal adjustment mode
      if (isNormalDeficit) {
        const binInfo = getBinHierarchy(binId);
        setConfirmDialog({
          isOpen: true,
          title: 'Negative Stock Balance Warning',
          message: (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                Decreasing <span className="font-bold text-red-600">{numQty} {uom}</span> will result in a negative stock balance in bin{' '}
                <span className="font-bold text-slate-900 dark:text-white">{binInfo.code}</span>.
              </p>
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-lg border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 space-y-1">
                <div className="flex justify-between">
                  <span>Current Stock:</span>
                  <span className="font-semibold">{availableBalance} {uom}</span>
                </div>
                <div className="flex justify-between text-red-700 dark:text-red-400 font-bold">
                  <span>Projected Balance:</span>
                  <span>{normalProjectedBalance} {uom} (DEFICIT)</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Do you wish to confirm this negative stock adjustment?
              </p>
            </div>
          ),
          action: () => executeStandardAdjustment(true)
        });
        return;
      }

      await executeStandardAdjustment(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-800 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          Stores & Inventory Management
        </span>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Workspace Header */}
        <div className="px-8 py-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-primary rounded-xl border border-blue-100 dark:border-blue-800">
              {mode === 'STOCK_IN' && <ArrowDownToLine className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
              {mode === 'STOCK_OUT' && <ArrowUpFromLine className="w-6 h-6 text-rose-600 dark:text-rose-400" />}
              {mode === 'ADJUST' && <SlidersHorizontal className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                {mode === 'STOCK_IN' && 'Stock In (Direct Receipt)'}
                {mode === 'STOCK_OUT' && 'Stock Out (Direct Issue)'}
                {mode === 'ADJUST' && 'Stock Adjustment & Reconciliation'}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {mode === 'STOCK_IN' && 'Inward raw material into warehouse bins. Increases physical balance and writes ledger record.'}
                {mode === 'STOCK_OUT' && 'Direct issue of material from warehouse bins. Validates balance and records reason.'}
                {mode === 'ADJUST' && 'Cycle count reconciliation. Correct physical variance with audit documentation.'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleModeChange('STOCK_IN')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'STOCK_IN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Stock In (Receipt)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('STOCK_OUT')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'STOCK_OUT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>Stock Out (Issue)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('ADJUST')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                mode === 'ADJUST'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Stock Adjustment</span>
            </button>
          </div>

          {/* Sub-Mode Switcher for Stock Adjustment: Normal vs Bin Movement */}
          {mode === 'ADJUST' && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/60">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                Adjustment Workflow Option
              </div>
              <div className="inline-flex p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl border border-slate-300/60 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => handleAdjustmentTypeChange('NORMAL')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustmentType === 'NORMAL'
                      ? 'bg-white dark:bg-slate-900 text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/10'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>1. Normal Adjustment (Single Bin)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAdjustmentTypeChange('TRANSFER')}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    adjustmentType === 'TRANSFER'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>2. Stock Movement (Bin-to-Bin Transfer)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Material & Locations */}
            <div className="space-y-5">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {isTransferMode ? 'Material & Transfer Locations' : 'Material & Location'}
              </h2>

              {/* Product Selection */}
              <FormField label="Product / Raw Material" required>
                <SearchSelect
                  value={productId}
                  onChange={(id) => {
                    setProductId(id);
                    setBinId('');
                    setSourceBinId('');
                    setTargetBinId('');
                    setQuantity('');
                    const prod = products.find(p => p.id === id);
                    if (prod?.uom) {
                      setSelectedUom(prod.uom.toUpperCase());
                    }
                  }}
                  options={productOptions}
                  isLoading={isLoadingMaster}
                  placeholder="Search and select product..."
                />
              </FormField>

              {/* === BRANCH 1: TRANSFER MODE (Dual Bin: Source & Target) === */}
              {isTransferMode ? (
                <>
                  {/* Source Bin Selection */}
                  <FormField
                    label="Source Bin (Origin)"
                    required
                    hint={
                      productId && sourceBinId && sourceCurrentQty <= 0
                        ? `Notice: Bin has 0 ${uom} in stock. Moving stock will create a negative balance.`
                        : productId && sourceBinId
                        ? `Available in this bin: ${sourceCurrentQty} ${uom}`
                        : undefined
                    }
                  >
                    <SearchSelect
                      value={sourceBinId}
                      onChange={(id) => {
                        setSourceBinId(id);
                        // Update default quantity if positive stock exists in newly selected bin
                        const match = productBalances.find(pb => pb.binId === id);
                        if (match && Number(match.currentQuantity) > 0) {
                          setQuantity(String(match.currentQuantity));
                        }
                      }}
                      options={sourceBinOptions}
                      isLoading={isLoadingBalances}
                      disabled={!productId}
                      placeholder={
                        !productId ? 'Select a product first...' : 'Select or type source bin...'
                      }
                    />
                  </FormField>

                  {/* Target Bin Selection */}
                  <FormField
                    label="Target Bin (Destination)"
                    required
                    hint={
                      sourceBinId && targetBinId === sourceBinId
                        ? 'Target bin cannot be the same as source bin'
                        : undefined
                    }
                  >
                    <SearchSelect
                      value={targetBinId}
                      onChange={(id) => setTargetBinId(id)}
                      options={targetBinOptions}
                      disabled={!productId || !sourceBinId}
                      placeholder={
                        !productId
                          ? 'Select product first...'
                          : !sourceBinId
                          ? 'Select source bin first...'
                          : 'Select destination warehouse location...'
                      }
                    />
                  </FormField>
                </>
              ) : (
                /* === BRANCH 2: STANDARD / NORMAL SINGLE BIN MODE === */
                <>
                  <FormField
                    label={mode === 'ADJUST' ? 'Bin / Location' : 'Target Bin'}
                    required
                    hint={
                      productId && isDeduction && singleBinOptions.length === 0
                        ? 'No bins with positive stock balance found for this product.'
                        : undefined
                    }
                  >
                    <SearchSelect
                      value={binId}
                      onChange={(id) => {
                        setBinId(id);
                        setQuantity('');
                      }}
                      options={singleBinOptions}
                      isLoading={isLoadingBalances}
                      disabled={!productId}
                      placeholder={
                        !productId
                          ? 'Select a product first...'
                          : singleBinOptions.length === 0
                          ? 'No bins available'
                          : 'Select warehouse location...'
                      }
                    />
                  </FormField>

                  {/* Normal Balance Card Indicator */}
                  {productId && binId && (
                    <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-blue-900 dark:text-blue-300">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                        <span className="text-xs font-medium">Available Balance in this Bin:</span>
                      </div>
                      <span className="font-bold text-base tabular-nums">
                        {availableBalance} {uom}
                      </span>
                    </div>
                  )}

                  {/* Adjustment Direction Toggle */}
                  {mode === 'ADJUST' && adjustmentType === 'NORMAL' && (
                    <FormField label="Adjustment Direction" required>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setDirection('INCREASE')}
                          className={`py-2.5 px-4 text-sm font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                            direction === 'INCREASE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-500'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          + Increase Stock (+)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirection('DECREASE')}
                          className={`py-2.5 px-4 text-sm font-semibold rounded-lg border text-center transition-all cursor-pointer ${
                            direction === 'DECREASE'
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-400 shadow-sm ring-1 ring-rose-500'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          − Decrease Stock (−)
                        </button>
                      </div>
                    </FormField>
                  )}
                </>
              )}

              {/* Quantity Input */}
              <FormField
                label="Movement Quantity"
                required
                error={
                  isStockOutExceeded
                    ? `Cannot exceed available balance (${availableBalance} ${uom})`
                    : undefined
                }
              >
                <div className="flex gap-2.5">
                  <div className="flex-1">
                    <NumberInput
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      min="0.001"
                      step="any"
                      placeholder="0.000"
                      error={isStockOutExceeded}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Select
                      value={selectedUom}
                      onChange={(e) => setSelectedUom(e.target.value)}
                      title="Unit of Measurement (UOM)"
                      className="font-semibold text-slate-800 dark:text-slate-200"
                    >
                      {UOM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </FormField>

              {/* === DUAL-BIN LIVE IMPACT VISUALIZER CARDS (Transfer Mode) === */}
              {isTransferMode && productId && sourceBinId && targetBinId && isQtyValid && (
                <div className="pt-2 space-y-3">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Live Transfer Simulation</span>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">Automatic In & Out</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Source Bin Preview Card */}
                    <div
                      className={`p-3.5 rounded-xl border transition-all ${
                        projectedSourceQty < 0
                          ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-500 dark:text-slate-400">Source (Outward)</span>
                        <TrendingDown className={`w-3.5 h-3.5 ${projectedSourceQty < 0 ? 'text-red-600' : 'text-slate-500'}`} />
                      </div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white truncate">
                        {getBinHierarchy(sourceBinId).code}
                      </div>
                      <div className="mt-2 text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span>Current:</span>
                          <span className="tabular-nums font-medium">{sourceCurrentQty} {uom}</span>
                        </div>
                        <div className="flex justify-between text-rose-600 dark:text-rose-400 font-semibold">
                          <span>Deduction:</span>
                          <span className="tabular-nums">−{numQty} {uom}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700/60 font-bold">
                          <span>Projected:</span>
                          <span
                            className={`tabular-nums ${
                              projectedSourceQty < 0 ? 'text-red-600 dark:text-red-400 font-extrabold' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {projectedSourceQty} {uom}
                          </span>
                        </div>
                      </div>
                      {projectedSourceQty < 0 && (
                        <div className="mt-2 px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 text-[10px] font-bold text-center">
                          DEFICIT BALANCE ({projectedSourceQty} {uom})
                        </div>
                      )}
                    </div>

                    {/* Target Bin Preview Card */}
                    <div className="p-3.5 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 transition-all">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Target (Inward)</span>
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="font-bold text-sm text-slate-800 dark:text-white truncate">
                        {getBinHierarchy(targetBinId).code}
                      </div>
                      <div className="mt-2 text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span>Current:</span>
                          <span className="tabular-nums font-medium">{targetCurrentQty} {uom}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                          <span>Addition:</span>
                          <span className="tabular-nums">+{numQty} {uom}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-emerald-200 dark:border-emerald-900 font-bold">
                          <span>Projected:</span>
                          <span className="tabular-nums text-emerald-700 dark:text-emerald-300 font-extrabold">
                            +{projectedTargetQty} {uom}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-[10px] font-bold text-center">
                        INWARD +{numQty} {uom}
                      </div>
                    </div>
                  </div>

                  {/* Negative Deficit Alert Banner */}
                  {projectedSourceQty < 0 && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <p className="font-bold">Negative Stock Warning</p>
                        <p className="text-amber-800 dark:text-amber-300">
                          Bin <span className="font-semibold">{getBinHierarchy(sourceBinId).code}</span> only has {sourceCurrentQty} {uom}. Moving {numQty} {uom} will produce a negative balance of <span className="font-bold text-red-600 dark:text-red-400">{projectedSourceQty} {uom}</span>. Confirmation is required before submitting.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Normal Deficit Alert Banner */}
              {isNormalDeficit && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-2.5 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold">Negative Stock Warning</p>
                    <p className="text-amber-800 dark:text-amber-300">
                      Decreasing stock by {numQty} {uom} will produce a deficit of{' '}
                      <span className="font-bold text-red-600 dark:text-red-400">{normalProjectedBalance} {uom}</span> in this bin. Confirmation is required.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Audit & Metadata */}
            <div className="space-y-5">
              <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Audit & Metadata</h2>

              <FormField
                label="Reason for Movement"
                required
                error={
                  trimmedReason.length > 0 && trimmedReason.length < 3
                    ? 'Reason must be at least 3 characters long'
                    : undefined
                }
                hint="Mandatory compliance note saved into the stock audit ledger"
              >
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    isTransferMode
                      ? 'e.g., Transfer from Bin 49 to Bin 70 for machine preparation, physical relocation...'
                      : 'e.g., Physical stock count reconciliation, Supplier batch receipt, Damage scrap...'
                  }
                  rows={3}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Lot / Batch Number" hint="Optional tracking ID">
                  <TextInput
                    value={lotBatchNumber}
                    onChange={(e) => setLotBatchNumber(e.target.value)}
                    placeholder="e.g. BAT-2026-001"
                  />
                </FormField>

                <FormField label="Unit Cost (₹)" hint="Optional cost">
                  <NumberInput
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </FormField>
              </div>

              <FormField label="Additional Remarks" hint="Optional notes">
                <Textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Any additional notes, reference PO numbers, or inspection notes..."
                  rows={3}
                />
              </FormField>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Info className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              <span>
                {isTransferMode
                  ? 'Bin-to-bin transfer atomically writes Outward and Inward ledger transactions.'
                  : 'All movements are permanently recorded with your user ID in the transaction ledger.'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <Button
                type="submit"
                variant={
                  mode === 'STOCK_OUT'
                    ? 'danger'
                    : isTransferSourceDeficit || isNormalDeficit
                    ? 'danger'
                    : 'primary'
                }
                disabled={!isFormValid}
                className="px-6 py-2.5 font-semibold text-sm rounded-lg shadow-sm"
              >
                {isSubmitting
                  ? 'Processing...'
                  : mode === 'STOCK_IN'
                  ? 'Confirm Stock In'
                  : mode === 'STOCK_OUT'
                  ? 'Confirm Stock Out'
                  : isTransferMode
                  ? 'Confirm Stock Movement'
                  : 'Confirm Adjustment'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* Confirmation Dialog for Negative Stock Balances */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Yes, Proceed with Deficit Balance"
        cancelText="Cancel & Review"
        isDanger={true}
      />
    </div>
  );
}
