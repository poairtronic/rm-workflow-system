import { useState, useEffect, useMemo } from 'react';
import { RotateCcw, Send, PackagePlus } from 'lucide-react';
import { PageHeader, SearchSelect, type SearchSelectOption } from '../components/ui';
import { workflowService, type SC } from '../services/workflowService';
import { masterDataService, type Product } from '../services/masterDataService';
import { inventoryService, type ProductBinBalance } from '../services/inventoryService';
import { unwrapList } from '../services/api';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import toast from 'react-hot-toast';

export function ProductionRequestReturnWorkspace() {
  const [activeTab, setActiveTab] = useState<'REQUEST' | 'RETURN'>('REQUEST');

  const [scList, setScList] = useState<SC[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // TAB 1: REQUEST FORM STATE
  const [selectedScIdForReq, setSelectedScIdForReq] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestQty, setRequestQty] = useState<number | ''>('');
  const [requestReason, setRequestReason] = useState('ADDITIONAL_REQUIREMENT');
  const [requestRemarks, setRequestRemarks] = useState('');
  const [submittingReq, setSubmittingReq] = useState(false);
  const [requestHistory, setRequestHistory] = useState<any[]>([]);

  // PRODUCT STOCK AVAILABILITY STATE (STORES STOCK)
  const [productStockLoading, setProductStockLoading] = useState(false);
  const [productStockBalances, setProductStockBalances] = useState<ProductBinBalance[]>([]);

  useEffect(() => {
    if (!selectedProductId) {
      setProductStockBalances([]);
      return;
    }
    let isCancelled = false;
    const fetchStock = async () => {
      setProductStockLoading(true);
      try {
        const balances = await inventoryService.getBalancesByProduct(selectedProductId);
        if (!isCancelled) {
          setProductStockBalances(Array.isArray(balances) ? balances : []);
        }
      } catch (err) {
        console.error('Failed to load product stock balances', err);
        if (!isCancelled) {
          setProductStockBalances([]);
        }
      } finally {
        if (!isCancelled) {
          setProductStockLoading(false);
        }
      }
    };
    fetchStock();
    return () => {
      isCancelled = true;
    };
  }, [selectedProductId]);

  // TAB 2: RETURN FORM STATE
  const [selectedScIdForRet, setSelectedScIdForRet] = useState('');
  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [selectedRmItemId, setSelectedRmItemId] = useState('');
  const [returnQty, setReturnQty] = useState<number | ''>('');
  const [returnCondition, setReturnCondition] = useState('REUSABLE');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [submittingRet, setSubmittingRet] = useState(false);
  const [returnHistory, setReturnHistory] = useState<any[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [scRes, prodRes, retHistory] = await Promise.all([
        workflowService.getScList(),
        masterDataService.getProducts({ isActive: true, pageSize: 1000 }),
        workflowService.getReturns(),
      ]);

      const scs = unwrapList(scRes);
      const prods = unwrapList(prodRes);

      setScList(scs || []);
      setProducts(prods || []);
      setReturnHistory(retHistory || []);

      if (scs && scs.length > 0) {
        setSelectedScIdForReq(scs[0].id);
        setSelectedScIdForRet(scs[0].id);
        loadReceivedItemsForSc(scs[0].id);
        loadRequestHistory(scs[0].id);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load active jobs or products catalog.');
    } finally {
      setLoading(false);
    }
  };

  const loadReceivedItemsForSc = async (scId: string) => {
    if (!scId) {
      setReceivedItems([]);
      return;
    }
    try {
      const acc = await workflowService.getAccounting(scId);
      // Filter items that have received quantity > 0
      const rec = (acc?.items || []).filter((item: any) => Number(item.received || item.issued) > 0);
      setReceivedItems(rec);
      if (rec.length > 0) {
        setSelectedRmItemId(rec[0].rmItemId);
        setReturnQty(1);
      } else {
        setSelectedRmItemId('');
        setReturnQty('');
      }
    } catch (err) {
      console.error('Failed to load accounting items for SC', scId, err);
      setReceivedItems([]);
    }
  };

  const loadRequestHistory = async (scId?: string) => {
    try {
      const reqs = await workflowService.getAdditionalRequests(scId);
      setRequestHistory(reqs || []);
    } catch (err) {
      console.error('Failed to load request history', err);
    }
  };

  const handleScChangeForReq = (scId: string) => {
    setSelectedScIdForReq(scId);
    loadRequestHistory(scId);
  };

  const handleScChangeForRet = (scId: string) => {
    setSelectedScIdForRet(scId);
    loadReceivedItemsForSc(scId);
  };

  // SUBMIT REQUEST (TAB 1)
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScIdForReq) {
      toast.error('Please select an active SC / PO reference.');
      return;
    }
    if (!selectedProductId) {
      toast.error('Please select a product or part to request.');
      return;
    }
    if (!requestQty || Number(requestQty) <= 0) {
      toast.error('Please enter a valid requested quantity.');
      return;
    }

    setSubmittingReq(true);
    try {
      const prod = products.find((p) => p.id === selectedProductId);
      const prodDesc = prod ? `${prod.name} (${prod.code || 'NO-CODE'})` : 'Extra Material';

      await workflowService.createAdditionalRequest(
        selectedScIdForReq,
        [
          {
            productId: selectedProductId,
            quantity: Number(requestQty),
            remarks: `Product: ${prodDesc}. Notes: ${requestRemarks || 'Requested by production'}`,
          },
        ],
        requestReason,
        requestRemarks
      );

      toast.success('Material request submitted to Stores!');
      setRequestQty('');
      setRequestRemarks('');
      await loadRequestHistory(selectedScIdForReq);
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, 'Failed to submit material request'));
    } finally {
      setSubmittingReq(false);
    }
  };

  // SUBMIT RETURN (TAB 2)
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScIdForRet) {
      toast.error('Please select an active SC / PO reference.');
      return;
    }
    if (!selectedRmItemId) {
      toast.error('Please select an item to return.');
      return;
    }
    if (!returnQty || Number(returnQty) <= 0) {
      toast.error('Please enter a valid return quantity.');
      return;
    }

    setSubmittingRet(true);
    try {
      await workflowService.recordReturn(
        selectedScIdForRet,
        [
          {
            rmItemId: selectedRmItemId,
            quantityReturned: Number(returnQty),
          },
        ],
        `Condition: ${returnCondition}. Remarks: ${returnRemarks || 'Returned from shopfloor'}`
      );

      toast.success('Material return submitted to Stores for verification!');
      setReturnQty('');
      setReturnRemarks('');
      const updatedReturns = await workflowService.getReturns();
      setReturnHistory(updatedReturns || []);
      await loadReceivedItemsForSc(selectedScIdForRet);
    } catch (err: any) {
      console.error(err);
      toast.error(extractErrorMessage(err, 'Failed to submit material return'));
    } finally {
      setSubmittingRet(false);
    }
  };

  const scOptions: SearchSelectOption[] = useMemo(() => {
    return scList.map((sc) => ({
      id: sc.id,
      primary: `${sc.scNumber} • ${sc.productName}`,
      secondary: sc.purchaseOrder?.poNumber ? `PO: ${sc.purchaseOrder.poNumber}` : 'Direct SC',
    }));
  }, [scList]);

  const productOptions: SearchSelectOption[] = useMemo(() => {
    return products.map((p) => ({
      id: p.id,
      primary: `${p.code ? `[${p.code}] ` : ''}${p.name}`,
      secondary: [p.family?.name, p.uom ? `UOM: ${p.uom}` : undefined].filter(Boolean).join(' • ') || undefined,
    }));
  }, [products]);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const availableStoresStock = useMemo(() => {
    return productStockBalances.reduce(
      (sum, b) => sum + (Number(b.currentQuantity) || 0),
      0
    );
  }, [productStockBalances]);

  const stockLocationDetails = useMemo(() => {
    return productStockBalances
      .filter((b) => (Number(b.currentQuantity) || 0) > 0)
      .map((b) => {
        const loc = b.locationName || 'Stores';
        const binOrRack = b.binCode || b.rackCode;
        const qtyStr = `${Number(b.currentQuantity).toLocaleString()} ${selectedProduct?.uom || 'units'}`;
        return binOrRack ? `${loc} (${binOrRack}): ${qtyStr}` : `${loc}: ${qtyStr}`;
      });
  }, [productStockBalances, selectedProduct?.uom]);

  const selectedItemData = receivedItems.find((it) => it.rmItemId === selectedRmItemId);

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="RM Request & Return"
        subtitle="Universal shop-floor portal to request additional materials/hardware or return unused stock back to Stores."
        actionSlot={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('REQUEST')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'REQUEST'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>1. Request Material</span>
            </button>
            <button
              onClick={() => setActiveTab('RETURN')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'RETURN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>2. Return Material</span>
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : activeTab === 'REQUEST' ? (
        /* TAB 1: REQUEST MATERIAL */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Request Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-fit">
            <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
              <PackagePlus className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">Request Any Product</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Request extra raw materials, standard hardware (screws, pins, washers), or consumables against active jobs.
            </p>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Job Reference (SC / PO) *
                </label>
                <SearchSelect
                  options={scOptions}
                  value={selectedScIdForReq}
                  onChange={handleScChangeForReq}
                  placeholder="Select SC or PO..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Product / Part to Request *
                </label>
                <SearchSelect
                  options={productOptions}
                  value={selectedProductId}
                  onChange={setSelectedProductId}
                  placeholder="Search any product (Bush, Screw, Pin...)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Qty Needed *
                    </label>
                    {selectedProductId && !productStockLoading && (
                      <span className={`text-[11px] font-bold ${availableStoresStock > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                        Stores: {availableStoresStock.toLocaleString()} {selectedProduct?.uom || ''}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={requestQty}
                    onChange={(e) => setRequestQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />

                  {/* Available Stock in Stores Indicator */}
                  {selectedProductId ? (
                    productStockLoading ? (
                      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                        <div className="w-2.5 h-2.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        <span>Checking stores stock...</span>
                      </div>
                    ) : availableStoresStock > 0 ? (
                      <div className="mt-1.5 space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Available in Stores: {availableStoresStock.toLocaleString()} {selectedProduct?.uom || 'units'}</span>
                        </div>
                        {stockLocationDetails.length > 0 && (
                          <p className="text-[10px] text-slate-600 font-medium truncate" title={stockLocationDetails.join(', ')}>
                            📍 {stockLocationDetails.join(', ')}
                          </p>
                        )}
                        {requestQty !== '' && Number(requestQty) > availableStoresStock && (
                          <p className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5">
                            ⚠️ Exceeds available stock ({availableStoresStock} {selectedProduct?.uom || 'units'}).
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1.5 space-y-0.5">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          <span>Stores Stock: 0 {selectedProduct?.uom || 'units'} (Out of Stock)</span>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Item will be queued for Stores procurement.
                        </p>
                      </div>
                    )
                  ) : (
                    <p className="mt-1.5 text-[11px] text-slate-400 italic">
                      Select product above to see stock
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Reason
                  </label>
                  <select
                    value={requestReason}
                    onChange={(e) => setRequestReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="ADDITIONAL_REQUIREMENT">Hardware / Consumables / Extra Requirement</option>
                    <option value="TOOL_WEAR_SCRAP">Tool Wear / Breakage</option>
                    <option value="DAMAGE">Damaged Part / Defect</option>
                    <option value="WASTAGE">First Article / Sample Setup / Wastage</option>
                    <option value="MANUFACTURING_ERROR">Machining Setup Scrap / Error</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={requestRemarks}
                  onChange={(e) => setRequestRemarks(e.target.value)}
                  placeholder="e.g. 2 extra screws for bottom flange"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingReq}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-xs transition-colors disabled:opacity-50 mt-2"
              >
                <Send className="w-4 h-4" />
                <span>{submittingReq ? 'Sending...' : 'Send Request to Stores'}</span>
              </button>
            </form>
          </div>

          {/* Request History Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Requests for Selected Job</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Status of material requests sent to Stores' Extra Requests queue.
                </p>
              </div>
            </div>

            {requestHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No extra requests submitted for this job yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Req Date</th>
                    <th className="px-5 py-3">Reason</th>
                    <th className="px-5 py-3">Details / Qty</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {requestHistory.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 text-xs">
                        {req.reason || 'EXTRA_MATERIAL'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {(req.items || []).map((it: any) => `Qty: ${it.quantityRequested || it.quantity}`).join(', ')}
                        {req.remarks && <span className="block text-[11px] text-slate-500 mt-0.5">{req.remarks}</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            req.status === 'ISSUED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : req.status === 'APPROVED'
                              ? 'bg-blue-100 text-blue-700'
                              : req.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        /* TAB 2: RETURN MATERIAL */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Return Form */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-6 shadow-xs h-fit">
            <div className="flex items-center space-x-2 pb-4 mb-4 border-b border-slate-100">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-base text-slate-900">Return Unused Material</h3>
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Select items received against this job to return excess or scrap back to Stores.
            </p>

            <form onSubmit={handleSubmitReturn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Job Reference (SC / PO) *
                </label>
                <SearchSelect
                  options={scOptions}
                  value={selectedScIdForRet}
                  onChange={handleScChangeForRet}
                  placeholder="Select SC or PO..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Item Received on Job *
                </label>
                {receivedItems.length === 0 ? (
                  <div className="text-xs text-amber-600 p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                    No received materials found for this job yet.
                  </div>
                ) : (
                  <select
                    value={selectedRmItemId}
                    onChange={(e) => setSelectedRmItemId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    {receivedItems.map((it) => (
                      <option key={it.rmItemId} value={it.rmItemId}>
                        {it.material} ({it.grade || 'STD'}) • Available WIP: {it.wip ?? (it.received || it.issued)}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedItemData && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between">
                  <span className="text-slate-500">Available to return (WIP):</span>
                  <span className="font-bold text-emerald-700">
                    {selectedItemData.wip ?? (Number(selectedItemData.received || selectedItemData.issued) - Number(selectedItemData.returned || 0))} {selectedItemData.size || 'units'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Return Qty *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={returnQty}
                    onChange={(e) => setReturnQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="Qty to return"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Condition
                  </label>
                  <select
                    value={returnCondition}
                    onChange={(e) => setReturnCondition(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium"
                  >
                    <option value="REUSABLE">Reusable Excess</option>
                    <option value="SCRAP">Scrap / Off-cut</option>
                    <option value="DAMAGED">Damaged / Defect</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Uncut 500mm bar returned"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={submittingRet || receivedItems.length === 0}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-xs transition-colors disabled:opacity-50 mt-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{submittingRet ? 'Sending Return...' : 'Submit Return to Stores'}</span>
              </button>
            </form>
          </div>

          {/* Return History Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Returns Sent to Stores</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stores verifies these returns in Return Verify, which automatically restores inventory stock.
                </p>
              </div>
            </div>

            {returnHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No returns submitted yet.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Return Date</th>
                    <th className="px-5 py-3">Job (SC #)</th>
                    <th className="px-5 py-3">Item / Quantity</th>
                    <th className="px-5 py-3 text-right">Verification Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnHistory.map((ret) => (
                    <tr key={ret.id} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3 text-xs text-slate-500">
                        {new Date(ret.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 font-semibold text-slate-900 text-xs">
                        {ret.salesOrderComponent?.scNumber || ret.scNumber || 'N/A'}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-700">
                        {(ret.items || []).map((it: any) => `${it.rmItem?.material || 'Material'}: ${it.quantityReturned}`).join(', ') || `Qty: ${ret.quantityReturned || 1}`}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                            ret.status === 'ACKNOWLEDGED' || ret.status === 'VERIFIED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : ret.status === 'REJECTED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ret.status === 'ACKNOWLEDGED' ? 'Verified in Stock' : ret.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
