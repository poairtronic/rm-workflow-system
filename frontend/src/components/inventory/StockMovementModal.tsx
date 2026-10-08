import React, { useState, useEffect } from 'react';
import {
  Modal,
  FormField,
  SearchSelect,
  NumberInput,
  Textarea,
  Button,
} from '../ui';
import type { SearchSelectOption } from '../ui';
import {
  inventoryService,
  type ProductBinBalance,
} from '../../services/inventoryService';
import { masterDataService, type Product, type Bin } from '../../services/masterDataService';
import { toast } from 'react-hot-toast';
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Info } from 'lucide-react';

export type StockMovementMode = 'STOCK_IN' | 'STOCK_OUT' | 'ADJUST';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: StockMovementMode;
  initialProductId?: string;
  initialBinId?: string;
  onSuccess: () => void;
}

export function StockMovementModal({
  isOpen,
  onClose,
  mode,
  initialProductId,
  initialBinId,
  onSuccess,
}: StockMovementModalProps) {
  const [productId, setProductId] = useState<string>('');
  const [binId, setBinId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [reason, setReason] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [productBalances, setProductBalances] = useState<ProductBinBalance[]>([]);
  
  const [isLoadingMaster, setIsLoadingMaster] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load master products and bins when opened
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingMaster(true);

    Promise.all([
      masterDataService.getProducts({ pageSize: 1000 }),
      masterDataService.getBins({ pageSize: 1000 }),
    ])
      .then(([productsRes, binsRes]) => {
        if (!isMounted) return;
        setProducts(productsRes.data || []);
        setAllBins((binsRes.data || []).filter(b => b.isActive));
      })
      .catch(() => {
        if (!isMounted) return;
        toast.error('Failed to load products and bins master data');
      })
      .finally(() => {
        if (isMounted) setIsLoadingMaster(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Handle initial prop values or resets
  useEffect(() => {
    if (isOpen) {
      setProductId(initialProductId || '');
      setBinId(initialBinId || '');
      setQuantity('');
      setDirection(mode === 'STOCK_OUT' ? 'DECREASE' : 'INCREASE');
      setReason('');
      setRemarks('');
    }
  }, [isOpen, initialProductId, initialBinId, mode]);

  // Whenever productId changes, fetch available balances for this product
  useEffect(() => {
    if (!productId) {
      setProductBalances([]);
      return;
    }

    let isMounted = true;
    setIsLoadingBalances(true);

    inventoryService
      .getBalancesByProduct(productId)
      .then((res) => {
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

  const selectedProduct = products.find((p) => p.id === productId);
  const uom = selectedProduct?.uom || 'NOS';

  // Compute available balance in selected bin
  const selectedBinBalance = productBalances.find((b) => b.binId === binId);
  const availableBalance = selectedBinBalance ? Number(selectedBinBalance.currentQuantity) : 0;

  // Options for product SearchSelect
  const productOptions: SearchSelectOption[] = products.map((p) => ({
    id: p.id,
    primary: p.name,
    secondary: `${p.code}${p.uom ? ` • ${p.uom}` : ''}${p.minimumInventory ? ` (MSL: ${p.minimumInventory})` : ''}`,
  }));

  // Options for bin SearchSelect
  let binOptions: SearchSelectOption[] = [];

  if (mode === 'STOCK_OUT' || (mode === 'ADJUST' && direction === 'DECREASE')) {
    // Only bins with existing stock > 0
    binOptions = productBalances
      .filter((b) => Number(b.currentQuantity) > 0)
      .map((b) => ({
        id: b.binId,
        primary: b.binCode || 'Bin',
        secondary: `Available: ${b.currentQuantity} ${uom} • ${b.warehouseName || 'Warehouse'}`,
      }));
  } else {
    // Stock In or Adjust Increase: All active bins, with current balance hinted if present
    binOptions = allBins.map((b) => {
      const match = productBalances.find((pb) => pb.binId === b.id);
      const currentQty = match ? Number(match.currentQuantity) : 0;
      const rackLocation = b.rack ? `${b.rack.code}` : '';
      return {
        id: b.id,
        primary: b.code,
        secondary: `${b.name || ''}${rackLocation ? ` (${rackLocation})` : ''}${currentQty > 0 ? ` • Current: ${currentQty} ${uom}` : ''}`,
      };
    });
  }

  // Numerical quantity check
  const numQty = parseFloat(quantity);
  const isQtyValid = !isNaN(numQty) && numQty > 0;

  // Check if quantity exceeds balance for deductions
  const isDeduction = mode === 'STOCK_OUT' || (mode === 'ADJUST' && direction === 'DECREASE');
  const isQtyExceeded = isDeduction && isQtyValid && numQty > availableBalance;

  // Reason validation: required, min 3 chars
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
      if (mode === 'STOCK_IN') {
        await inventoryService.stockIn({
          productId,
          binId,
          quantity: numQty,
          reason: trimmedReason,
          remarks: remarks.trim() || undefined,
        });
        toast.success(`Successfully stocked in ${numQty} ${uom}`);
      } else if (mode === 'STOCK_OUT') {
        await inventoryService.stockOut({
          productId,
          binId,
          quantity: numQty,
          reason: trimmedReason,
          remarks: remarks.trim() || undefined,
        });
        toast.success(`Successfully stocked out ${numQty} ${uom}`);
      } else if (mode === 'ADJUST') {
        await inventoryService.adjustStock({
          productId,
          binId,
          quantity: numQty,
          direction,
          reason: trimmedReason,
          remarks: remarks.trim() || undefined,
        });
        toast.success(`Successfully adjusted stock (${direction === 'INCREASE' ? '+' : '-'}${numQty} ${uom})`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      // Handled by api client toast or show error
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = (
    <div className="flex items-center space-x-2">
      {mode === 'STOCK_IN' && <ArrowDownToLine className="w-5 h-5 text-emerald-600" />}
      {mode === 'STOCK_OUT' && <ArrowUpFromLine className="w-5 h-5 text-rose-600" />}
      {mode === 'ADJUST' && <SlidersHorizontal className="w-5 h-5 text-blue-600" />}
      <span>
        {mode === 'STOCK_IN' && 'Stock In (Direct Receipt)'}
        {mode === 'STOCK_OUT' && 'Stock Out (Direct Issue)'}
        {mode === 'ADJUST' && 'Stock Adjustment'}
      </span>
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} className="sm:max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Explanatory Notice */}
        <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs text-slate-600 flex items-start space-x-2">
          <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            {mode === 'STOCK_IN' && (
              <span>Receive raw material into a physical bin. Increases bin stock balance and records a required reason in the ledger.</span>
            )}
            {mode === 'STOCK_OUT' && (
              <span>Deduct material directly from stores bin. Requires an existing stock balance and mandatory reason.</span>
            )}
            {mode === 'ADJUST' && (
              <span>Reconcile physical variance (+ or -). Directly adjusts the bin balance and updates the audit trail.</span>
            )}
          </div>
        </div>

        {/* Product SearchSelect */}
        <FormField label="Product" required>
          <SearchSelect
            value={productId}
            onChange={(id) => {
              setProductId(id);
              setBinId('');
              setQuantity('');
            }}
            options={productOptions}
            isLoading={isLoadingMaster}
            placeholder="Search and select product..."
          />
        </FormField>

        {/* Bin SearchSelect */}
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
                : 'Select bin...'
            }
          />
        </FormField>

        {/* Selected Bin Stock Info */}
        {productId && binId && (
          <div className="p-2.5 rounded-md bg-sky-50 border border-sky-100 flex items-center justify-between text-xs text-sky-800">
            <span>Available Balance in this Bin:</span>
            <span className="font-semibold text-sm">
              {availableBalance} {uom}
            </span>
          </div>
        )}

        {/* Adjustment Direction Toggle */}
        {mode === 'ADJUST' && (
          <FormField label="Adjustment Direction" required>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDirection('INCREASE')}
                className={`py-2 px-3 text-sm font-medium rounded-md border text-center transition-colors ${
                  direction === 'INCREASE'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                + Increase (+)
              </button>
              <button
                type="button"
                onClick={() => setDirection('DECREASE')}
                className={`py-2 px-3 text-sm font-medium rounded-md border text-center transition-colors ${
                  direction === 'DECREASE'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                - Decrease (−)
              </button>
            </div>
          </FormField>
        )}

        {/* Quantity NumberInput */}
        <FormField
          label="Quantity"
          required
          error={
            isQtyExceeded
              ? `Cannot exceed available balance (${availableBalance} ${uom})`
              : undefined
          }
        >
          <NumberInput
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            min="0.001"
            step="any"
            unit={uom}
            placeholder="0.000"
            error={isQtyExceeded}
          />
        </FormField>

        {/* Reason Textarea (Required) */}
        <FormField
          label="Reason"
          required
          error={
            trimmedReason.length > 0 && trimmedReason.length < 3
              ? 'Reason must be at least 3 characters long'
              : undefined
          }
          hint="Mandatory audit explanation for this stock mutation"
        >
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason (e.g., Supplier Delivery #1024, Damage write-off, Cycle count correction)..."
            rows={2}
          />
        </FormField>

        {/* Remarks (Optional) */}
        <FormField label="Remarks" hint="Optional internal notes or reference IDs">
          <Textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional additional remarks..."
            rows={2}
          />
        </FormField>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-gray-200 flex items-center justify-end space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === 'STOCK_OUT' ? 'danger' : 'primary'}
            disabled={!isFormValid}
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
      </form>
    </Modal>
  );
}
