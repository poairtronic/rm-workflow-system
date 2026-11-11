import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  X,
  AlertCircle,
  CheckCircle2,
  Ban,
  PauseCircle,
  Send,
  Check,
  RefreshCw,
  History,
} from 'lucide-react';
import { SearchSelect, type SearchSelectOption } from '../ui';
import { workflowService } from '../../services/workflowService';
import { inventoryService } from '../../services/inventoryService';
import { masterDataService, type Product } from '../../services/masterDataService';
import { extractErrorMessage } from '../../utils/extractErrorMessage';
import { unwrapList } from '../../services/api';

interface IssueMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scId: string;
  scNumber: string;
  additionalRequestId?: string;
}

interface PreviousIssueItem {
  issueNumber: string;
  issuedProductName: string;
  quantityIssued: number;
  issuedAt: string;
  remarks?: string;
}

interface ItemData {
  rmItemId: string;

  // Original Design Request
  originalMaterial: string;
  originalGrade: string;
  originalSize: string;
  originalQuantity: number;
  description?: string;

  // Actual Product to be issued
  issuedProductId: string;
  issuedProductName: string;
  isChangingProduct: boolean;

  // Quantities & Status
  required: number;
  customRequiredQty?: number;
  issued: number;
  remaining: number;
  totalAvailable: number;
  issueQty: number | '';
  includeInIssue: boolean;

  // Storage Location
  selectedBinId?: string;
  availableBins?: { binId: string; binCode: string; rackCode?: string; currentQuantity: number }[];

  // Issue History
  previousIssues?: PreviousIssueItem[];
}

export function IssueMaterialModal({
  isOpen,
  onClose,
  onSuccess,
  scId,
  scNumber,
  additionalRequestId,
}: IssueMaterialModalProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingSingleIdx, setSubmittingSingleIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<ItemData[]>([]);
  const [remarks, setRemarks] = useState('');

  // Build product options for SearchSelect
  const productOptions: SearchSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      primary: `${p.code ? `[${p.code}] ` : ''}${p.name}`,
      secondary: `${p.family?.name || (p as any).materialType || 'Product'} • UOM: ${p.uom || 'NOS'}`,
    }));
  }, [products]);

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    } else {
      setItems([]);
      setRemarks('');
      setError(null);
    }
  }, [isOpen, scId, additionalRequestId]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch products from Product Master for substitution
      const pRes = await masterDataService.getProducts({ isActive: true, pageSize: 1000 });
      const pList = unwrapList(pRes);
      const allProds = pList.length > 0 ? pList : (pRes as any)?.data || [];
      setProducts(allProds);

      // 2. Fetch requested items for SC
      let sourceItems: { rmItem: any; requiredQty: number }[] = [];

      if (additionalRequestId) {
        const addReqs = await workflowService.getAdditionalRequests(scId);
        const req = addReqs.find((r) => r.id === additionalRequestId);
        if (!req) throw new Error('Additional request not found.');

        sourceItems = (req.items || []).map((item: any) => ({
          rmItem: item.rmItem || {
            id: item.rmItemId,
            material: item.material || 'Material Item',
            mappedProductId: item.productId || item.mappedProductId,
            grade: 'STD',
            size: 'STD',
          },
          requiredQty: Number(item.quantityApproved || item.quantityRequested || item.quantity || 0),
        }));
      } else {
        const rmRes = await workflowService.getRmList(scId);
        if (!rmRes || rmRes.length === 0) {
          throw new Error('No RM request found for this SC.');
        }
        sourceItems = (rmRes[0].items || []).map((item: any) => ({
          rmItem: item,
          requiredQty: Number(item.quantity),
        }));
      }

      // 3. Fetch accounting & previous issue transactions
      const accountingRes = await workflowService.getAccounting(scId);

      const itemsData: ItemData[] = [];

      for (const { rmItem, requiredQty } of sourceItems) {
        let issued = 0;
        let remaining = requiredQty;

        if (!additionalRequestId) {
          const accItem = accountingRes.items.find((a: any) => a.rmItemId === rmItem.id);
          issued = accItem ? Number(accItem.issued) : 0;
          remaining = Math.max(0, Math.round((requiredQty - issued) * 1000) / 1000);
        } else {
          issued = 0;
        }

        // Previous issues history
        const previousIssues: PreviousIssueItem[] = [];
        (accountingRes.issues || []).forEach((iss: any) => {
          (iss.items || []).forEach((it: any) => {
            if (it.rmItemId === rmItem.id) {
              previousIssues.push({
                issueNumber: iss.issueNumber,
                issuedProductName: it.productName || it.material || 'Material',
                quantityIssued: Number(it.quantityIssued) || 0,
                issuedAt: iss.createdAt,
                remarks: iss.remarks,
              });
            }
          });
        });

        const activeProductId = rmItem.mappedProductId || '';
        let totalAvailable = 0;
        let availableBins: { binId: string; binCode: string; rackCode?: string; currentQuantity: number }[] = [];

        if (activeProductId) {
          const balances = await inventoryService.getBalancesByProduct(activeProductId);
          availableBins = (balances || [])
            .filter((b: any) => Number(b.currentQuantity) > 0)
            .map((b: any) => ({
              binId: b.binId,
              binCode: b.bin?.code || b.binCode || 'BIN',
              rackCode: b.rackCode || b.bin?.rack?.code,
              currentQuantity: Number(b.currentQuantity),
            }));
          totalAvailable = availableBins.reduce((sum, b) => sum + b.currentQuantity, 0);
          totalAvailable = Math.round(totalAvailable * 1000) / 1000;
        }

        const remainingToIssue = remaining > 0 ? remaining : 0;
        const canIssue = totalAvailable > 0 && remainingToIssue > 0;
        const initialIssueQty = canIssue ? Math.min(remainingToIssue, totalAvailable) : '';

        // If product was already substituted, get its name from master catalog or fallback
        const currentProd = allProds.find((p: Product) => p.id === activeProductId);
        const resolvedProdName = currentProd?.name || rmItem.material;

        itemsData.push({
          rmItemId: rmItem.id,
          originalMaterial: rmItem.originalMaterial || rmItem.material,
          originalGrade: rmItem.originalGrade || rmItem.grade || '',
          originalSize: rmItem.originalSize || rmItem.size || '',
          originalQuantity: Number(rmItem.originalQuantity || rmItem.quantity || requiredQty),
          description: rmItem.description || '',

          issuedProductId: activeProductId,
          issuedProductName: resolvedProdName,
          isChangingProduct: false,

          required: requiredQty,
          issued,
          remaining,
          totalAvailable,
          issueQty: initialIssueQty,
          includeInIssue: canIssue,
          availableBins,
          selectedBinId: availableBins.length > 0 ? availableBins[0].binId : '',
          previousIssues,
        });
      }

      setItems(itemsData);
    } catch (err: any) {
      console.error(err);
      setError(extractErrorMessage(err, 'Failed to load RM data.'));
    } finally {
      setLoading(false);
    }
  };

  // Stores can change / substitute product
  const handleSelectAlternativeProduct = async (itemIdx: number, newProductId: string) => {
    const selectedProd = products.find((p) => p.id === newProductId);
    if (!selectedProd) return;

    try {
      const balances = await inventoryService.getBalancesByProduct(newProductId);
      const availableBins = (balances || [])
        .filter((b: any) => Number(b.currentQuantity) > 0)
        .map((b: any) => ({
          binId: b.binId,
          binCode: b.bin?.code || b.binCode || 'BIN',
          rackCode: b.rackCode || b.bin?.rack?.code,
          currentQuantity: Number(b.currentQuantity),
        }));
      const totalAvailable = Math.round(availableBins.reduce((sum, b) => sum + b.currentQuantity, 0) * 1000) / 1000;

      setItems((prev) => {
        const next = [...prev];
        const it = next[itemIdx];
        it.issuedProductId = selectedProd.id;
        it.issuedProductName = selectedProd.name;
        it.availableBins = availableBins;
        it.totalAvailable = totalAvailable;
        it.selectedBinId = availableBins.length > 0 ? availableBins[0].binId : '';
        it.isChangingProduct = false;

        const effectiveReq = it.customRequiredQty !== undefined ? it.customRequiredQty : it.required;
        const remaining = Math.max(0, Math.round((effectiveReq - it.issued) * 1000) / 1000);
        it.remaining = remaining;

        if (totalAvailable > 0 && remaining > 0) {
          it.issueQty = Math.min(remaining, totalAvailable);
          it.includeInIssue = true;
        } else {
          it.issueQty = '';
          it.includeInIssue = false;
        }

        return next;
      });
    } catch (err) {
      console.error('Failed to load balances for substituted product', err);
    }
  };

  // Stores can edit required quantity for substituted product
  const handleUpdateCustomRequired = (itemIdx: number, newReqVal: number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = next[itemIdx];
      it.customRequiredQty = newReqVal > 0 ? newReqVal : undefined;
      const effectiveReq = newReqVal > 0 ? newReqVal : it.required;
      const remaining = Math.max(0, Math.round((effectiveReq - it.issued) * 1000) / 1000);
      it.remaining = remaining;

      if (it.totalAvailable > 0 && remaining > 0) {
        it.issueQty = Math.min(remaining, it.totalAvailable);
        it.includeInIssue = true;
      }
      return next;
    });
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

  const toggleIncludeItem = (itemIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = next[itemIdx];
      const willInclude = !it.includeInIssue;
      it.includeInIssue = willInclude;
      if (willInclude && (!it.issueQty || Number(it.issueQty) <= 0)) {
        it.issueQty = Math.min(it.remaining, it.totalAvailable > 0 ? it.totalAvailable : it.remaining);
      }
      return next;
    });
  };

  const setMaxAllowedQty = (itemIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = next[itemIdx];
      const maxAllowed = Math.min(it.remaining, it.totalAvailable);
      it.issueQty = maxAllowed;
      it.includeInIssue = true;
      return next;
    });
  };

  const toggleProductEditMode = (itemIdx: number) => {
    setItems((prev) => {
      const next = [...prev];
      next[itemIdx].isChangingProduct = !next[itemIdx].isChangingProduct;
      return next;
    });
  };

  // Single Item Issue Action
  const handleIssueSingleItem = async (itemIdx: number) => {
    const item = items[itemIdx];
    if (!item.issueQty || Number(item.issueQty) <= 0) {
      setError(`Please specify a valid issue quantity for "${item.issuedProductName}".`);
      return;
    }
    if (Number(item.issueQty) > item.totalAvailable) {
      setError(`Cannot issue ${item.issueQty} — only ${item.totalAvailable} available in stock for "${item.issuedProductName}".`);
      return;
    }

    const itemPayload: any = {
      rmItemId: item.rmItemId,
      quantityIssued: Number(item.issueQty),
      issuedProductId: item.issuedProductId || undefined,
      issuedProductName: item.issuedProductName || undefined,
      newRequiredQuantity: item.customRequiredQty !== undefined ? Number(item.customRequiredQty) : undefined,
    };
    if (item.selectedBinId && item.selectedBinId.trim()) {
      itemPayload.binId = item.selectedBinId.trim();
    }

    setSubmittingSingleIdx(itemIdx);
    setError(null);
    try {
      await workflowService.createIssue(scId, [itemPayload], remarks, additionalRequestId);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(extractErrorMessage(err, `Failed to issue "${item.issuedProductName}".`));
    } finally {
      setSubmittingSingleIdx(null);
    }
  };

  // Batch Issue Action
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payloadItems: any[] = [];

    for (const item of items) {
      if (item.includeInIssue && item.issueQty && Number(item.issueQty) > 0) {
        if (Number(item.issueQty) > item.totalAvailable) {
          setError(
            `Cannot issue ${item.issueQty} for "${item.issuedProductName}" — only ${item.totalAvailable} available in stock.`
          );
          return;
        }
        const itemPayload: any = {
          rmItemId: item.rmItemId,
          quantityIssued: Number(item.issueQty),
          issuedProductId: item.issuedProductId || undefined,
          issuedProductName: item.issuedProductName || undefined,
          newRequiredQuantity: item.customRequiredQty !== undefined ? Number(item.customRequiredQty) : undefined,
        };
        if (item.selectedBinId && item.selectedBinId.trim()) {
          itemPayload.binId = item.selectedBinId.trim();
        }
        payloadItems.push(itemPayload);
      }
    }

    if (payloadItems.length === 0) {
      setError('Please select and specify quantity for at least one item to issue.');
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
      setError(extractErrorMessage(err, 'Failed to issue material.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const includedItems = items.filter((it) => it.includeInIssue && Number(it.issueQty) > 0);
  const totalUnitsToIssue =
    Math.round(includedItems.reduce((acc, it) => acc + Number(it.issueQty || 0), 0) * 1000) / 1000;
  const skippedItemsCount = items.length - includedItems.length;

  return (
    <div className="max-w-5xl mx-auto w-full pb-12">
      {/* Top Navigation & Breadcrumb */}
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Queue</span>
        </button>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Stores Fulfillment & Substitution
        </span>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-8 py-5 bg-slate-50/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Issue Material to Production</h2>
            <p className="text-sm text-slate-500 mt-1">
              Sales Component: <span className="font-semibold text-slate-800">{scNumber}</span>
              <span className="ml-3 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                Direct Substitution Enabled
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-8 mt-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="p-8">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {items.map((item, itemIdx) => {
                const isOutOfStock = item.totalAvailable === 0;
                const isIncluded = item.includeInIssue && !isOutOfStock;
                const isFullyIssued = item.remaining === 0;
                const isSubstituted = item.issuedProductName !== item.originalMaterial;

                return (
                  <div
                    key={item.rmItemId}
                    className={`border rounded-xl overflow-hidden transition-all ${
                      isIncluded
                        ? 'border-indigo-300 ring-1 ring-indigo-200 bg-white shadow-xs'
                        : isOutOfStock
                        ? 'border-amber-200 bg-amber-50/20 opacity-90'
                        : 'border-slate-200 bg-slate-50/40 opacity-85'
                    }`}
                  >
                    {/* Item Top Bar */}
                    <div className="bg-slate-50/90 p-4 border-b border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                      {/* Left: Original Request Info & Substituted Status */}
                      <div className="flex-1 min-w-[260px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                            Requested RM:
                          </span>
                          <h4 className="font-bold text-slate-900 text-base">{item.originalMaterial}</h4>

                          {isSubstituted && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              Substituted with: {item.issuedProductName}
                            </span>
                          )}

                          {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                              <Ban className="w-3 h-3" />
                              Out of Stock
                            </span>
                          ) : !item.includeInIssue ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                              <PauseCircle className="w-3 h-3" />
                              Skipped
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              Ready to Issue
                            </span>
                          )}
                        </div>

                        {/* Specs & Description */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                          <span>
                            Spec / Grade: <strong className="text-slate-700 font-semibold">{item.originalGrade || '—'}</strong>
                          </span>
                          {item.description && (
                            <span>
                              Description: <strong className="text-indigo-700 font-medium italic">"{item.description}"</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Quantity Metrics & Toggle */}
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Design Req</span>
                          <span className="font-bold text-slate-800">{item.originalQuantity}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Issued</span>
                          <span className="font-bold text-indigo-600">{item.issued}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Remaining</span>
                          <span className="font-bold text-purple-700">{item.remaining}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-500 block">Stock ({item.issuedProductName})</span>
                          <span className={`font-bold ${isOutOfStock ? 'text-red-600' : 'text-emerald-700'}`}>
                            {item.totalAvailable}
                          </span>
                        </div>

                        {/* Inclusion Toggle */}
                        {!isOutOfStock && !isFullyIssued && (
                          <button
                            type="button"
                            onClick={() => toggleIncludeItem(itemIdx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                              item.includeInIssue
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {item.includeInIssue ? '✓ Included' : '+ Include'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Item Body: Material Substitution & Issue Controls */}
                    <div className="p-5 space-y-4">
                      {/* Product Substitution Bar */}
                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                            Actual Material to Issue:
                          </span>
                          <strong className="text-sm font-bold text-indigo-950">
                            {item.issuedProductName}
                          </strong>
                          {isSubstituted && (
                            <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold border border-amber-200">
                              Alternative
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleProductEditMode(itemIdx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 shadow-2xs transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{item.isChangingProduct ? 'Close Substitution' : 'Change / Substitute Material'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Inline Product Selector for Substitution */}
                      {item.isChangingProduct && (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                              Select Alternative Product from Catalog
                            </span>
                            <span className="text-xs text-indigo-600">
                              Original requested was: <strong>{item.originalMaterial}</strong>
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Product Master Catalog *
                              </label>
                              <SearchSelect
                                value={item.issuedProductId}
                                onChange={(selectedId) => handleSelectAlternativeProduct(itemIdx, selectedId)}
                                options={productOptions}
                                placeholder="Search & select alternative product..."
                                className="w-full text-sm"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Substituted Target Required Qty (Optional)
                              </label>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                value={item.customRequiredQty ?? item.required}
                                onChange={(e) => handleUpdateCustomRequired(itemIdx, Number(e.target.value))}
                                placeholder={`Default: ${item.required}`}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                              <p className="text-[11px] text-slate-500 mt-1">
                                Adjust target quantity if the substituted material has different unit requirements.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Out of Stock Alert */}
                      {isOutOfStock ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-800">
                          <div className="flex items-center space-x-2">
                            <Ban className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Warehouse stock is 0 for {item.issuedProductName}.</strong> This item will <strong>not be issued now</strong> and will safely stay pending in Stores until stock is inwarded.
                            </span>
                          </div>
                          <span className="font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded">
                            Pending {item.remaining} Units
                          </span>
                        </div>
                      ) : !item.includeInIssue ? (
                        <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center space-x-2">
                            <PauseCircle className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Item skipped for this issue batch. It will remain pending in Stores.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleIncludeItem(itemIdx)}
                            className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-white border border-slate-300 rounded hover:bg-indigo-50 cursor-pointer"
                          >
                            Include in Issue
                          </button>
                        </div>
                      ) : (
                        /* Fulfillment Inputs: Issue Qty, Rack & Bin, Actions */
                        <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
                          <div className="flex flex-wrap items-end gap-4">
                            {/* Quantity Input */}
                            <div className="w-48">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-slate-700">Issue Quantity *</label>
                                {item.totalAvailable > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setMaxAllowedQty(itemIdx)}
                                    className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                                  >
                                    Full ({Math.min(item.remaining, item.totalAvailable)})
                                  </button>
                                )}
                              </div>
                              <input
                                type="number"
                                step="0.001"
                                min="0.001"
                                max={Math.min(item.remaining, item.totalAvailable)}
                                value={item.issueQty}
                                onChange={(e) => updateItemQty(itemIdx, e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold tabular-nums"
                                placeholder="Qty to issue"
                              />
                            </div>

                            {/* Rack & Bin Selector */}
                            <div className="w-64">
                              <label className="block text-xs font-bold text-slate-700 mb-1">Rack & Bin *</label>
                              <select
                                value={item.selectedBinId || ''}
                                onChange={(e) => updateItemBin(itemIdx, e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                              >
                                {item.availableBins && item.availableBins.length > 0 ? (
                                  item.availableBins.map((b) => (
                                    <option key={b.binId} value={b.binId}>
                                      {b.rackCode ? `Rack ${b.rackCode} - Bin ${b.binCode}` : `Bin ${b.binCode}`} • Avail: {b.currentQuantity}
                                    </option>
                                  ))
                                ) : (
                                  <option value="" disabled>No stock in any rack/bin</option>
                                )}
                              </select>
                            </div>

                            {/* Status Pill */}
                            {item.issueQty && Number(item.issueQty) >= item.remaining ? (
                              <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg font-semibold mb-0.5 flex items-center space-x-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Full issue (Completes item)</span>
                              </div>
                            ) : item.issueQty && Number(item.issueQty) < item.remaining ? (
                              <div className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-3 py-2 rounded-lg font-semibold mb-0.5 flex items-center space-x-1">
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>Partial issue ({Math.round((item.remaining - Number(item.issueQty)) * 1000) / 1000} remains open)</span>
                              </div>
                            ) : null}
                          </div>

                          {/* Dedicated Single Item Issue Button */}
                          <div>
                            <button
                              type="button"
                              onClick={() => handleIssueSingleItem(itemIdx)}
                              disabled={
                                submitting ||
                                submittingSingleIdx !== null ||
                                !item.issueQty ||
                                Number(item.issueQty) <= 0 ||
                                Number(item.issueQty) > item.totalAvailable
                              }
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg shadow-2xs transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Issue only this line item right now. Other items will remain in the Stores queue."
                            >
                              {submittingSingleIdx === itemIdx ? (
                                <span>Issuing...</span>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Issue This Item Only</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Past Issue Transactions History */}
                      {item.previousIssues && item.previousIssues.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-2">
                            <History className="w-3.5 h-3.5 text-slate-400" />
                            <span>Previous Issue History for this Component Item:</span>
                          </div>
                          <div className="space-y-1.5">
                            {item.previousIssues.map((pIss, pIdx) => (
                              <div
                                key={pIdx}
                                className="flex items-center justify-between text-xs bg-slate-50 px-3 py-1.5 rounded border border-slate-200"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-800">{pIss.issuedProductName}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-500">
                                    {new Date(pIss.issuedAt).toLocaleDateString()}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400">({pIss.issueNumber})</span>
                                </div>
                                <span className="font-bold text-indigo-700 tabular-nums">
                                  {pIss.quantityIssued} Units Issued
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Remarks */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remarks (Optional)</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                  rows={2}
                  placeholder="Any notes about this issue (e.g. material substitution justification or batch details)..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Summary Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 px-8 py-4 bg-slate-50/80">
          <div className="text-xs text-slate-600">
            <span>Selected for Issue: </span>
            <strong className="text-indigo-900 font-bold">{includedItems.length}</strong> of {items.length} materials (
            <strong className="text-indigo-900 font-bold">{totalUnitsToIssue}</strong> total units).
            {skippedItemsCount > 0 && (
              <span className="ml-2 text-purple-700 font-semibold">
                ({skippedItemsCount} item{skippedItemsCount > 1 ? 's' : ''} skipped — will remain in Stores queue)
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer"
              disabled={submitting || submittingSingleIdx !== null}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                submitting ||
                submittingSingleIdx !== null ||
                loading ||
                includedItems.length === 0 ||
                totalUnitsToIssue <= 0
              }
              className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Issuing...' : `Issue Selected Material (${totalUnitsToIssue} Units)`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
