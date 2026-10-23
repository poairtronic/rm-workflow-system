import { useState, useEffect, useMemo } from 'react';
import {
  Printer,
  X,
  FileEdit,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { ConsumableLineItemRecord } from '../../types/consumables.types';

export interface EditPrIndentModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ConsumableLineItemRecord[];
  onConfirmPrint: (
    updatedItems: Array<{ id: string; purchaseQty: number; unitPrice?: number }>,
  ) => Promise<void>;
  isSubmitting?: boolean;
}

interface EditableEntry {
  id: string;
  item: ConsumableLineItemRecord;
  purchaseQty: number;
  unitPrice: number;
}

export function EditPrIndentModal({
  isOpen,
  onClose,
  items,
  onConfirmPrint,
  isSubmitting = false,
}: EditPrIndentModalProps) {
  const [entries, setEntries] = useState<EditableEntry[]>([]);

  // Synchronize entries whenever modal opens or items change
  useEffect(() => {
    if (isOpen && items.length > 0) {
      setEntries(
        items.map((it) => {
          const existingPurchase = it.purchaseQty != null ? Number(it.purchaseQty) : null;
          const req = Number(it.requestedQty) || 0;
          const initialQty = existingPurchase != null && existingPurchase > 0 ? existingPurchase : (req > 0 ? req : 1);
          const price = it.isNewVendor && it.newVendorPrice != null
            ? Number(it.newVendorPrice)
            : it.unitPrice != null
            ? Number(it.unitPrice)
            : 0;

          return {
            id: it.id,
            item: it,
            purchaseQty: initialQty,
            unitPrice: price,
          };
        }),
      );
    }
  }, [isOpen, items]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleQtyChange = (id: string, val: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, purchaseQty: val } : e)),
    );
  };

  const handlePriceChange = (id: string, val: number) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, unitPrice: val } : e)),
    );
  };

  // Metrics summary
  const { totalProdRequested, totalStoreIndent, totalEstimatedValue } = useMemo(() => {
    let prodReq = 0;
    let storeIndent = 0;
    let value = 0;

    for (const e of entries) {
      prodReq += Number(e.item.requestedQty) || 0;
      storeIndent += Number(e.purchaseQty) || 0;
      value += (Number(e.purchaseQty) || 0) * (Number(e.unitPrice) || 0);
    }

    return {
      totalProdRequested: prodReq,
      totalStoreIndent: storeIndent,
      totalEstimatedValue: value,
    };
  }, [entries]);

  if (!isOpen || items.length === 0) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = entries.map((e) => ({
      id: e.id,
      purchaseQty: Number(e.purchaseQty) || 0,
      unitPrice: Number(e.unitPrice) || 0,
    }));
    await onConfirmPrint(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-2xs">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Purchase Requisition Indent Preview
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                  {items.length} {items.length === 1 ? 'Item' : 'Items'} Selected
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Adjust actual purchase quantities for store safety buffer stock. Production requested quantities remain unchanged.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative Guidance Banner */}
        <div className="px-6 py-3 bg-blue-50/80 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
          <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Stores Safety Stock Policy:</strong> If Production requested 100 units, Stores can adjust the purchase indent to 150 units. The printed PR slip will reflect 150 units for the supplier, and on receipt, 100 units will deliver to Production while the remaining 50 units will be safely retained in Stores warehouse inventory.
          </div>
        </div>

        {/* Scrollable Editable Grid */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs bg-white dark:bg-slate-900">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4 min-w-[200px]">Description & Item Code</th>
                  <th className="py-3 px-3 min-w-[150px]">Vendor / Destination</th>
                  <th className="py-3 px-3 text-right w-32">Prod Req Qty</th>
                  <th className="py-3 px-4 text-right w-44">Store Indent Qty</th>
                  <th className="py-3 px-3 text-right w-28">Quoted Price</th>
                  <th className="py-3 px-4 text-right w-32">Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {entries.map((entry, idx) => {
                  const it = entry.item;
                  const reqQty = Number(it.requestedQty) || 0;
                  const purchaseQty = Number(entry.purchaseQty) || 0;
                  const price = Number(entry.unitPrice) || 0;
                  const lineTotal = purchaseQty * price;
                  const diff = purchaseQty - reqQty;

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors align-middle"
                    >
                      {/* S.No */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Description & Code */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white leading-snug">
                            {it.description}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                            {it.productCode && <span>Code: {it.productCode}</span>}
                            <span>• {it.uom}</span>
                            {it.prNumber && <span className="text-indigo-600 dark:text-indigo-400 font-bold">PR #{it.prNumber}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Vendor Context */}
                      <td className="py-3 px-3 text-[11px] text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[140px]" title={it.vendorName || it.newVendorName || 'Open Sourcing'}>
                            {it.vendorName || it.newVendorName || 'Open Sourcing'}
                          </span>
                        </div>
                      </td>

                      {/* Production Requested Qty (READ-ONLY) */}
                      <td className="py-3 px-3 text-right font-mono">
                        <div className="inline-flex flex-col items-end">
                          <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                            {reqQty} {it.uom}
                          </span>
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            Original Req
                          </span>
                        </div>
                      </td>

                      {/* Store Indent / Purchase Qty (EDITABLE) */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-1.5 justify-end">
                            <input
                              type="number"
                              required
                              min="0.001"
                              step="any"
                              value={entry.purchaseQty}
                              onChange={(e) =>
                                handleQtyChange(entry.id, parseFloat(e.target.value) || 0)
                              }
                              className="w-24 px-2.5 py-1.5 text-right font-mono font-bold text-sm rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-2xs focus:outline-none"
                            />
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                              {it.uom}
                            </span>
                          </div>

                          {/* Dynamic Safety Stock Badge */}
                          {diff > 0 ? (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
                              +{diff} {it.uom} safety stock
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mt-1 inline-flex items-center gap-1">
                              {diff} {it.uom} partial purchase
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 mt-1">
                              Exact request match
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quoted Price (Editable) */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <span className="text-slate-400 text-xs">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={entry.unitPrice}
                            onChange={(e) =>
                              handlePriceChange(entry.id, parseFloat(e.target.value) || 0)
                            }
                            className="w-20 px-2 py-1 text-right font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                          />
                        </div>
                      </td>

                      {/* Line Total */}
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white text-xs">
                        ₹{lineTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Metrics Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Production Requested</span>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
                {totalProdRequested} Units
              </p>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Total Stores Indent</span>
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 font-mono">
                {totalStoreIndent} Units
                {totalStoreIndent > totalProdRequested && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">
                    (+{totalStoreIndent - totalProdRequested} buffer)
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-400 uppercase font-semibold text-[10px]">Estimated Requisition Value</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 font-mono">
                ₹{totalEstimatedValue.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs text-slate-400">
              Clicking Confirm will update purchase quantities and open the official Velan Requisition Slip.
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer shadow-xs px-4"
              >
                <Printer className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving & Generating...' : 'Confirm & Print Slip'}</span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditPrIndentModal;
