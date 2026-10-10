import React, { useState, useEffect } from 'react';
import { ArrowLeft, X, AlertCircle } from 'lucide-react';
import { workflowService } from '../../services/workflowService';
import { inventoryService } from '../../services/inventoryService';

interface IssueMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scId: string;
  scNumber: string;
  additionalRequestId?: string;
}

interface ItemData {
  rmItemId: string;
  material: string;
  grade: string;
  size: string;
  mappedProductId?: string;
  required: number;
  issued: number;
  remaining: number;
  totalAvailable: number;
  issueQty: number | '';
  selectedBinId?: string;
  availableBins?: { binId: string; binCode: string; currentQuantity: number }[];
}

export function IssueMaterialModal({ isOpen, onClose, onSuccess, scId, scNumber, additionalRequestId }: IssueMaterialModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [items, setItems] = useState<ItemData[]>([]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setItems([]);
      setRemarks('');
      setError(null);
    }
  }, [isOpen, scId, additionalRequestId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      let sourceItems: { rmItem: any; requiredQty: number }[] = [];

      if (additionalRequestId) {
        const addReqs = await workflowService.getAdditionalRequests(scId);
        const req = addReqs.find(r => r.id === additionalRequestId);
        if (!req) throw new Error('Additional request not found.');
        
        sourceItems = req.items.map((item: any) => ({
          rmItem: item.rmItem,
          requiredQty: Number(item.quantityApproved || item.quantityRequested)
        }));
      } else {
        const rmRes = await workflowService.getRmList(scId);
        if (!rmRes || rmRes.length === 0) {
          throw new Error('No RM request found for this SC.');
        }
        sourceItems = (rmRes[0].items || []).map((item: any) => ({
          rmItem: item,
          requiredQty: Number(item.quantity)
        }));
      }

      const accountingRes = await workflowService.getAccounting(scId);

      const itemsData: ItemData[] = [];

      for (const { rmItem, requiredQty } of sourceItems) {
        let issued = 0;
        let remaining = requiredQty;

        if (!additionalRequestId) {
          const accItem = accountingRes.items.find((a: any) => a.rmItemId === rmItem.id);
          issued = accItem ? Number(accItem.issued) : 0;
          remaining = Math.max(0, requiredQty - issued);
        } else {
          // For additional requests, we don't track partial issues currently, so assume full remaining
          issued = 0;
        }
        
        let totalAvailable = 0;
        let availableBins: { binId: string; binCode: string; currentQuantity: number }[] = [];
        if (rmItem.mappedProductId) {
          const balances = await inventoryService.getBalancesByProduct(rmItem.mappedProductId);
          availableBins = (balances || [])
            .filter((b: any) => Number(b.currentQuantity) > 0)
            .map((b: any) => ({
              binId: b.binId,
              binCode: b.bin?.code || b.binCode || 'BIN',
              currentQuantity: Number(b.currentQuantity),
            }));
          totalAvailable = availableBins.reduce((sum, b) => sum + b.currentQuantity, 0);
        }

        itemsData.push({
          rmItemId: rmItem.id,
          material: rmItem.material,
          grade: rmItem.grade,
          size: rmItem.size,
          mappedProductId: rmItem.mappedProductId,
          required: requiredQty,
          issued,
          remaining,
          totalAvailable,
          issueQty: remaining > 0 ? remaining : '',
          availableBins,
          selectedBinId: availableBins.length === 1 ? availableBins[0].binId : '',
        });
      }

      setItems(itemsData);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to load RM data.');
    } finally {
      setLoading(false);
    }
  };

  const updateItemQty = (itemIdx: number, value: any) => {
    const newItems = [...items];
    newItems[itemIdx].issueQty = value;
    setItems(newItems);
  };

  const updateItemBin = (itemIdx: number, binId: string) => {
    const newItems = [...items];
    newItems[itemIdx].selectedBinId = binId;
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const payloadItems: any[] = [];
    
    for (const item of items) {
      if (item.issueQty && Number(item.issueQty) > 0) {
        const itemPayload: any = {
          rmItemId: item.rmItemId,
          quantityIssued: Number(item.issueQty),
        };
        // Only include binId if explicitly selected; omit if empty string so backend auto-allocates
        if (item.selectedBinId && item.selectedBinId.trim()) {
          itemPayload.binId = item.selectedBinId.trim();
        }
        payloadItems.push(itemPayload);
      }
    }

    if (payloadItems.length === 0) {
      setError('Please specify quantity to issue for at least one item.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await workflowService.createIssue(scId, payloadItems, remarks, additionalRequestId);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to issue material.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="max-w-5xl mx-auto w-full pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Queue</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Stores Fulfillment
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Issue Material</h2>
            <p className="text-sm text-slate-500 mt-1">Sales Order Component: {scNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {items.map((item, itemIdx) => (
                <div key={item.rmItemId} className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">{item.material}</h4>
                      <p className="text-sm text-slate-600">
                        Grade: {item.grade} | Size: {item.size}
                      </p>
                      {!item.mappedProductId && (
                        <p className="text-xs text-amber-600 font-medium mt-1">
                          No product mapped in RM review. Cannot issue.
                        </p>
                      )}
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="text-slate-500 block">Required</span>
                        <span className="font-semibold">{item.required}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Issued</span>
                        <span className="font-semibold text-indigo-600">{item.issued}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Remaining</span>
                        <span className="font-semibold text-green-600">{item.remaining}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">In Stock</span>
                        <span className={`font-semibold ${item.totalAvailable < item.remaining ? 'text-red-600' : 'text-slate-900'}`}>
                          {item.totalAvailable}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    {item.totalAvailable === 0 && item.mappedProductId ? (
                      <p className="text-sm text-amber-600">No stock available for this item in warehouse.</p>
                    ) : item.mappedProductId ? (
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="w-48">
                          <label className="block text-xs font-medium text-slate-700 mb-1">Issue Quantity *</label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            max={Math.min(item.remaining, item.totalAvailable)}
                            value={item.issueQty}
                            onChange={(e) => updateItemQty(itemIdx, e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                            placeholder="Qty to issue"
                          />
                        </div>

                        <div className="w-64">
                          <label className="block text-xs font-medium text-slate-700 mb-1">Source Bin</label>
                          <select
                            value={item.selectedBinId || ''}
                            onChange={(e) => updateItemBin(itemIdx, e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          >
                            <option value="">Auto-allocate (Highest Stock)</option>
                            {(item.availableBins || []).map((b) => (
                              <option key={b.binId} value={b.binId}>
                                {b.binCode} • Avail: {b.currentQuantity}
                              </option>
                            ))}
                          </select>
                        </div>

                        {item.issueQty && Number(item.issueQty) < item.remaining && (
                          <div className="text-sm text-amber-600 italic mb-2">
                            * Partial issue
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Any notes about this issue..."
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-8 py-5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || loading || items.length === 0}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Issuing...' : 'Issue Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
