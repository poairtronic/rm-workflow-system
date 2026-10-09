import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Info,
  CheckCircle2
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
  type SearchSelectOption
} from '../components/ui';
import {
  inventoryService,
  type ProductBinBalance
} from '../services/inventoryService';
import { masterDataService, type Product, type Bin } from '../services/masterDataService';
import { useQueryClient } from '@tanstack/react-query';

export type StockMovementMode = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUST';

export const UOM_OPTIONS = ['MM', 'KG', 'NOS', 'MTR', 'PC', 'SQM', 'LTR'] as const;

export function StockMovementWorkspace() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const urlMode = (searchParams.get('mode') as StockMovementMode) || 'STOCK_IN';
  const urlProductId = searchParams.get('productId') || '';
  const urlBinId = searchParams.get('binId') || '';

  const [mode, setMode] = useState<StockMovementMode>(urlMode);
  const [productId, setProductId] = useState<string>(urlProductId);
  const [binId, setBinId] = useState<string>(urlBinId);
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
        setProductBalances(res || []);
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
  }, [productId]);

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

  // Compute available balance in selected bin
  const selectedBinBalance = productBalances.find(b => b.binId === binId);
  const availableBalance = selectedBinBalance ? Number(selectedBinBalance.currentQuantity) : 0;

  // Options for product SearchSelect
  const productOptions: SearchSelectOption[] = products.map(p => ({
    id: p.id,
    primary: p.name,
    secondary: `${p.code ? `${p.code} • ` : ''}${p.uom || 'KG'}${p.minimumInventory ? ` (MSL: ${p.minimumInventory})` : ''}`
  }));

  // Options for bin SearchSelect
  let binOptions: SearchSelectOption[] = [];
  const isDeduction = mode === 'STOCK_OUT' || (mode === 'ADJUST' && direction === 'DECREASE');

  if (isDeduction) {
    binOptions = productBalances
      .filter(b => Number(b.currentQuantity) > 0)
      .map(b => ({
        id: b.binId,
        primary: b.binCode || 'Bin',
        secondary: `Available: ${b.currentQuantity} ${uom} • ${b.warehouseName || 'Warehouse'}`
      }));
  } else {
    binOptions = allBins.map(b => {
      const match = productBalances.find(pb => pb.binId === b.id);
      const currentQty = match ? Number(match.currentQuantity) : 0;
      const rackLocation = b.rack ? `${b.rack.code}` : '';
      return {
        id: b.id,
        primary: b.code,
        secondary: `${b.name || ''}${rackLocation ? ` (${rackLocation})` : ''}${currentQty > 0 ? ` • Current: ${currentQty} ${uom}` : ''}`
      };
    });
  }

  const numQty = parseFloat(quantity);
  const isQtyValid = !isNaN(numQty) && numQty > 0;
  const isQtyExceeded = isDeduction && isQtyValid && numQty > availableBalance;
  const trimmedReason = reason.trim();
  const isReasonValid = trimmedReason.length >= 3;

  const isFormValid =
    !!productId &&
    !!binId &&
    isQtyValid &&
    !isQtyExceeded &&
    isReasonValid &&
    !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

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
          direction
        });
        toast.success(`Successfully adjusted stock (${direction === 'INCREASE' ? '+' : '-'}${numQty} ${uom})`);
      }

      // Invalidate relevant queries across the app
      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMslStatus'] });

      // Navigate back cleanly
      navigate(-1);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Overview</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Stores & Inventory Management
        </span>
      </div>

      {/* Main Workspace Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Workspace Header */}
        <div className="px-8 py-6 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-primary rounded-xl border border-blue-100">
              {mode === 'STOCK_IN' && <ArrowDownToLine className="w-6 h-6 text-emerald-600" />}
              {mode === 'STOCK_OUT' && <ArrowUpFromLine className="w-6 h-6 text-rose-600" />}
              {mode === 'ADJUST' && <SlidersHorizontal className="w-6 h-6 text-blue-600" />}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                {mode === 'STOCK_IN' && 'Stock In (Direct Receipt)'}
                {mode === 'STOCK_OUT' && 'Stock Out (Direct Issue)'}
                {mode === 'ADJUST' && 'Stock Adjustment & Reconciliation'}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
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
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'STOCK_IN'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>Stock In (Receipt)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('STOCK_OUT')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'STOCK_OUT'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>Stock Out (Issue)</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('ADJUST')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'ADJUST'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Stock Adjustment</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Product, Bin, Quantity */}
            <div className="space-y-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Material & Location</h2>

              <FormField label="Product / Raw Material" required>
                <SearchSelect
                  value={productId}
                  onChange={(id) => {
                    setProductId(id);
                    setBinId('');
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

              <FormField
                label="Target Bin"
                required
                hint={
                  productId && isDeduction && binOptions.length === 0
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
                  options={binOptions}
                  isLoading={isLoadingBalances}
                  disabled={!productId}
                  placeholder={
                    !productId
                      ? 'Select a product first...'
                      : binOptions.length === 0
                      ? 'No bins available'
                      : 'Select bin location...'
                  }
                />
              </FormField>

              {/* Balance Card Indicator */}
              {productId && binId && (
                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-blue-900">
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
              {mode === 'ADJUST' && (
                <FormField label="Adjustment Direction" required>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDirection('INCREASE')}
                      className={`py-2.5 px-4 text-sm font-semibold rounded-lg border text-center transition-all ${
                        direction === 'INCREASE'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm ring-1 ring-emerald-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      + Increase Stock (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection('DECREASE')}
                      className={`py-2.5 px-4 text-sm font-semibold rounded-lg border text-center transition-all ${
                        direction === 'DECREASE'
                          ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm ring-1 ring-rose-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      − Decrease Stock (−)
                    </button>
                  </div>
                </FormField>
              )}

              <FormField
                label="Movement Quantity"
                required
                error={
                  isQtyExceeded
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
                      error={isQtyExceeded}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <Select
                      value={selectedUom}
                      onChange={(e) => setSelectedUom(e.target.value)}
                      title="Unit of Measurement (UOM)"
                      className="font-semibold text-slate-800"
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
            </div>

            {/* Right Column: Reason, Batch, Remarks */}
            <div className="space-y-5">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit & Metadata</h2>

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
                  placeholder="e.g., Physical stock count reconciliation, Supplier batch receipt, Damage scrap..."
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
          <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>All movements are permanently recorded with your user ID in the transaction ledger.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <Button
                type="submit"
                variant={mode === 'STOCK_OUT' ? 'danger' : 'primary'}
                disabled={!isFormValid}
                className="px-6 py-2.5 font-semibold text-sm rounded-lg shadow-sm"
              >
                {isSubmitting
                  ? 'Processing...'
                  : mode === 'STOCK_IN'
                  ? 'Confirm Stock In'
                  : mode === 'STOCK_OUT'
                  ? 'Confirm Stock Out'
                  : 'Confirm Adjustment'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
