import { useState, useEffect } from 'react';
import { PlaySquare, AlertCircle, RefreshCcw, Plus, PackageMinus, CheckCircle, Scissors, ArrowLeft } from 'lucide-react';
import { StatusBadge } from '../components/ui/StatusBadge';
import { workflowService } from '../services/workflowService';
import type { SC, MaterialAccounting } from '../services/workflowService';

export function ProductionConsumptionWorkspace() {
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedSc, setSelectedSc] = useState<SC | null>(null);
  const [accounting, setAccounting] = useState<MaterialAccounting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active sub-view within selected SC: null (overview), 'EXTRA', 'RETURN', or 'CONSUME'
  const [activeAction, setActiveAction] = useState<'EXTRA' | 'RETURN' | 'CONSUME' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [extraItems, setExtraItems] = useState<Record<string, string>>({});
  const [extraReason, setExtraReason] = useState<string>('ADDITIONAL_REQUIREMENT');
  
  const [returnItems, setReturnItems] = useState<Record<string, string>>({});
  const [returnRemarks, setReturnRemarks] = useState('');

  const [consumeItemId, setConsumeItemId] = useState<string | null>(null);
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeRemarks, setConsumeRemarks] = useState('');

  useEffect(() => {
    loadSCs();
  }, []);

  const loadSCs = async () => {
    setLoading(true);
    try {
      // Get SCs that are active in production
      const data = await workflowService.getScList();
      const activeSCs = data.filter(sc => 
        ['ISSUED', 'PARTIALLY_ISSUED', 'IN_PRODUCTION'].includes(sc.status)
      );
      setScList(activeSCs);
    } catch (err: any) {
      setError(err.message || 'Failed to load SCs');
    } finally {
      setLoading(false);
    }
  };

  const selectSc = async (sc: SC) => {
    setSelectedSc(sc);
    await loadAccounting(sc.id);
  };

  const loadAccounting = async (scId: string) => {
    try {
      const data = await workflowService.getAccounting(scId);
      setAccounting(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load accounting data');
    }
  };

  const handleRequestExtra = async () => {
    if (!selectedSc || !accounting) return;
    
    const items = accounting.items.filter(item => {
      const qty = Number(extraItems[item.rmItemId]);
      return qty > 0;
    }).map(item => ({
      rmItemId: item.rmItemId,
      material: item.material,
      quantity: Number(extraItems[item.rmItemId])
    }));

    if (items.length === 0) {
      return alert('Please specify at least one quantity greater than zero.');
    }

    setSubmitting(true);
    try {
      await workflowService.createAdditionalRequest(selectedSc.id, items, extraReason);
      alert('Additional material requested successfully!');
      setActiveAction(null);
      setExtraItems({});
      await loadAccounting(selectedSc.id);
    } catch (err: any) {
      alert(err.message || 'Failed to request extra material');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnSurplus = async () => {
    if (!selectedSc || !accounting) return;

    const items = accounting.items.filter(item => {
      const qty = Number(returnItems[item.rmItemId]);
      return qty > 0;
    }).map(item => ({
      rmItemId: item.rmItemId,
      quantityReturned: Number(returnItems[item.rmItemId])
    }));

    if (items.length === 0) {
      return alert('Please specify at least one quantity greater than zero.');
    }

    // Validate against WIP
    for (const item of items) {
      const accItem = accounting.items.find(i => i.rmItemId === item.rmItemId);
      if (accItem && item.quantityReturned > accItem.wip) {
        return alert(`Cannot return more than available WIP for ${accItem.material}. Max available: ${accItem.wip}`);
      }
    }

    setSubmitting(true);
    try {
      await workflowService.recordReturn(selectedSc.id, items, returnRemarks);
      alert('Return initiated successfully. Stores will be notified to verify.');
      setActiveAction(null);
      setReturnItems({});
      setReturnRemarks('');
      await loadAccounting(selectedSc.id);
    } catch (err: any) {
      alert(err.message || 'Failed to initiate return');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsume = async () => {
    if (!selectedSc || !consumeItemId) return;
    
    const qty = Number(consumeQty);
    if (qty <= 0) return alert('Quantity must be greater than zero.');

    const accItem = accounting?.items.find(i => i.rmItemId === consumeItemId);
    if (accItem && qty > accItem.wip) {
      return alert(`Cannot consume more than available WIP. Max available: ${accItem.wip}`);
    }

    setSubmitting(true);
    try {
      await workflowService.recordConsumption(selectedSc.id, consumeItemId, qty, consumeRemarks);
      alert('Material consumption recorded successfully.');
      setActiveAction(null);
      setConsumeItemId(null);
      setConsumeQty('');
      setConsumeRemarks('');
      await loadAccounting(selectedSc.id);
    } catch (err: any) {
      alert(err.message || 'Failed to record consumption');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteSc = async () => {
    if (!selectedSc) return;
    
    // Warn if there is unreturned WIP
    const totalWip = accounting?.items.reduce((sum, item) => sum + item.wip, 0) || 0;
    let msg = 'Are you sure you want to complete this work order?';
    if (totalWip > 0) {
      msg = `WARNING: There are still ${totalWip} units of material in WIP. Are you sure you want to complete this SC without returning them?`;
    }

    if (!window.confirm(msg)) return;

    setSubmitting(true);
    try {
      await workflowService.completeSc(selectedSc.id);
      alert('Work order marked as completed!');
      setSelectedSc(null);
      setAccounting(null);
      await loadSCs();
    } catch (err: any) {
      alert(err.message || 'Failed to complete SC');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Production Data...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto flex gap-6">
      <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-bold text-slate-800">Active Work Orders</h2>
          <p className="text-xs text-slate-500 mt-1">Select an SC to manage materials</p>
        </div>
        <div className="overflow-y-auto flex-1">
          {scList.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No active SCs found.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {scList.map(sc => (
                <li key={sc.id}>
                  <button
                    onClick={() => selectSc(sc)}
                    className={`w-full text-left px-4 py-4 hover:bg-indigo-50 transition-colors ${
                      selectedSc?.id === sc.id ? 'bg-indigo-50 border-l-4 border-indigo-600' : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-slate-900">{sc.scNumber}</span>
                      <StatusBadge status={sc.status} />
                    </div>
                    <div className="text-sm text-slate-600 truncate">{sc.productName}</div>
                    <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                      Target Qty: {sc.targetQuantity}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="w-2/3">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!selectedSc ? (
          <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 p-12 text-center">
            <PlaySquare className="w-12 h-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No SC Selected</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              Select a work order from the list on the left to view accounting balances, request extra materials, or return surplus stock.
            </p>
          </div>
        ) : !accounting ? (
          <div className="p-8 text-center text-slate-500">Loading accounting data...</div>
        ) : (
          <div className="space-y-6">
            {!activeAction && (
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{selectedSc.scNumber}</h1>
                  <p className="text-slate-500">{selectedSc.productName}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCompleteSc}
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 border border-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete SC
                  </button>
                  <button
                    onClick={() => setActiveAction('EXTRA')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Request Extra
                  </button>
                  <button
                    onClick={() => setActiveAction('RETURN')}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
                  >
                    <PackageMinus className="w-4 h-4" />
                    Return Surplus
                  </button>
                </div>
              </div>
            )}

            {activeAction === 'EXTRA' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveAction(null)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Material Balance</span>
                  </button>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Request Additional RM
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-900">Request Extra Material</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Request additional raw materials from Stores for SC <span className="font-semibold text-slate-800">{selectedSc.scNumber}</span> ({selectedSc.productName})
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Reason for Request</label>
                      <select
                        value={extraReason}
                        onChange={(e) => setExtraReason(e.target.value)}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                      >
                        <option value="ADDITIONAL_REQUIREMENT">Additional Requirement</option>
                        <option value="DAMAGE">Damage</option>
                        <option value="WASTAGE">Wastage</option>
                        <option value="MANUFACTURING_ERROR">Manufacturing Error</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700">Material</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Target Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {accounting.items.map(item => (
                            <tr key={item.rmItemId} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-900">{item.material}</p>
                                <p className="text-xs text-slate-500">WIP: {item.wip}</p>
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.001"
                                  placeholder="0.000"
                                  value={extraItems[item.rmItemId] || ''}
                                  onChange={(e) => setExtraItems({ ...extraItems, [item.rmItemId]: e.target.value })}
                                  className="w-28 px-3 py-1.5 text-right bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary ml-auto block shadow-sm"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRequestExtra}
                      disabled={submitting}
                      className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeAction === 'RETURN' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveAction(null)}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Material Balance</span>
                  </button>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    Return Surplus RM
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-900">Return Surplus Material</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Return unused raw material to Stores for SC <span className="font-semibold text-slate-800">{selectedSc.scNumber}</span> ({selectedSc.productName})
                    </p>
                  </div>

                  <div className="p-6 space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks (Optional)</label>
                      <textarea
                        value={returnRemarks}
                        onChange={(e) => setReturnRemarks(e.target.value)}
                        placeholder="Reason for return..."
                        rows={2}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary resize-none shadow-sm"
                      />
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold text-slate-700">Material</th>
                            <th className="px-4 py-3 font-semibold text-slate-700 text-right">Return Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {accounting.items.map(item => {
                            const maxReturn = item.wip;
                            if (maxReturn <= 0) return null;

                            return (
                              <tr key={item.rmItemId} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-slate-900">{item.material}</p>
                                  <p className="text-xs text-slate-500">Max Available (WIP): <span className="font-semibold text-indigo-600">{maxReturn}</span></p>
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="number"
                                    min="0"
                                    max={maxReturn}
                                    step="0.001"
                                    placeholder="0.000"
                                    value={returnItems[item.rmItemId] || ''}
                                    onChange={(e) => setReturnItems({ ...returnItems, [item.rmItemId]: e.target.value })}
                                    className="w-28 px-3 py-1.5 text-right bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary ml-auto block shadow-sm"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => setActiveAction(null)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleReturnSurplus}
                      disabled={submitting}
                      className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submitting ? 'Submitting...' : 'Initiate Return'}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeAction === 'CONSUME' ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => { setActiveAction(null); setConsumeItemId(null); }}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Material Balance</span>
                  </button>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Log Consumption
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="text-xl font-bold text-slate-900">Record Material Consumption</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Log RM used for production on SC <span className="font-semibold text-slate-800">{selectedSc.scNumber}</span>
                    </p>
                  </div>

                  <div className="p-6 space-y-5">
                    {(() => {
                      const item = accounting.items.find(i => i.rmItemId === consumeItemId);
                      if (!item) return null;
                      return (
                        <>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="font-semibold text-slate-900">{item.material}</p>
                            <p className="text-sm text-slate-500 mt-0.5">Available WIP: <span className="font-bold text-indigo-600">{item.wip}</span></p>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity Consumed</label>
                            <input
                              type="number"
                              min="0"
                              max={item.wip}
                              step="0.001"
                              value={consumeQty}
                              onChange={(e) => setConsumeQty(e.target.value)}
                              placeholder="0.000"
                              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                            />
                          </div>
                        </>
                      );
                    })()}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Remarks (Optional)</label>
                      <textarea
                        value={consumeRemarks}
                        onChange={(e) => setConsumeRemarks(e.target.value)}
                        placeholder="Details of consumption or scrap..."
                        rows={2}
                        className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary resize-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => { setActiveAction(null); setConsumeItemId(null); }}
                      className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg bg-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConsume}
                      disabled={submitting}
                      className="px-5 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {submitting ? 'Recording...' : 'Record Consumption'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">Material Balance Panel</h3>
                  <button onClick={() => loadAccounting(selectedSc.id)} className="text-slate-400 hover:text-slate-600">
                    <RefreshCcw className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-200 bg-white">
                        <th className="px-6 py-3 font-medium">Material</th>
                        <th className="px-6 py-3 font-medium text-right bg-slate-50">Issued</th>
                        <th className="px-6 py-3 font-medium text-right bg-slate-50">Received</th>
                        <th className="px-6 py-3 font-medium text-right bg-amber-50">Consumed</th>
                        <th className="px-6 py-3 font-medium text-right bg-indigo-50">Returned</th>
                        <th className="px-6 py-3 font-medium text-right bg-indigo-50 text-indigo-700">WIP (Available)</th>
                        <th className="px-6 py-3 font-medium text-right bg-red-50 text-red-600">Unaccounted</th>
                        <th className="px-6 py-3 font-medium text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {accounting.items.map(item => (
                        <tr key={item.rmItemId} className="hover:bg-slate-50/50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{item.material}</p>
                            <p className="text-xs text-slate-500">{item.grade} • Req: {item.required}</p>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 bg-slate-50/50">{item.issued}</td>
                          <td className="px-6 py-4 text-right font-medium text-slate-700 bg-slate-50/50">{item.received}</td>
                          <td className="px-6 py-4 text-right font-medium text-amber-700 bg-amber-50/30">{item.consumed}</td>
                          <td className="px-6 py-4 text-right font-medium text-indigo-600 bg-indigo-50/30">
                            {item.returned}
                            {item.pendingReturned > 0 && (
                              <span className="block text-xs text-indigo-400">+{item.pendingReturned} pending</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-indigo-700 bg-indigo-50/50">{item.wip}</td>
                          <td className="px-6 py-4 text-right font-bold text-red-600 bg-red-50/30">{item.unaccounted}</td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => {
                                setConsumeItemId(item.rmItemId);
                                setConsumeQty('');
                                setConsumeRemarks('');
                                setActiveAction('CONSUME');
                              }}
                              disabled={item.wip <= 0}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <Scissors className="w-3.5 h-3.5" />
                              Consume
                            </button>
                          </td>
                        </tr>
                      ))}
                      {accounting.items.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                            No materials mapped for this SC yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
