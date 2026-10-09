import { useState, useEffect } from 'react';
import { 
  PlaySquare, 
  AlertCircle, 
  Plus, 
  FileText, 
  Printer, 
  Search, 
  Boxes
} from 'lucide-react';
import { workflowService, type SC, type MaterialAccounting } from '../services/workflowService';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export function ProductionConsumptionWorkspace() {
  const { currentUser } = useAuth();
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedSc, setSelectedSc] = useState<SC | null>(null);
  const [accounting, setAccounting] = useState<MaterialAccounting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Daily Consumption Modal State
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [consumeItemId, setConsumeItemId] = useState<string>('');
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeRemarks, setConsumeRemarks] = useState('');
  const [submittingConsume, setSubmittingConsume] = useState(false);

  useEffect(() => {
    loadSCs();
  }, []);

  const loadSCs = async () => {
    setLoading(true);
    try {
      const data = await workflowService.getScList();
      // Show SCs that have been issued, are in production, or completed
      const activeSCs = data.filter(sc => 
        ['ISSUED', 'PARTIALLY_ISSUED', 'IN_PRODUCTION', 'COMPLETED', 'CLOSED'].includes(sc.status)
      );
      setScList(activeSCs);
      if (activeSCs.length > 0 && !selectedSc) {
        selectSc(activeSCs[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Sales Order Components');
    } finally {
      setLoading(false);
    }
  };

  const selectSc = async (sc: SC) => {
    setSelectedSc(sc);
    await loadAccounting(sc.id);
  };

  const loadAccounting = async (scId: string) => {
    setLoadingAccounting(true);
    try {
      const data = await workflowService.getAccounting(scId);
      setAccounting(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load material accounting report');
    } finally {
      setLoadingAccounting(false);
    }
  };

  const handleRecordConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSc || !consumeItemId) return;
    const qty = Number(consumeQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid consumed quantity (> 0)');
      return;
    }

    setSubmittingConsume(true);
    try {
      await workflowService.recordConsumption(
        selectedSc.id,
        consumeItemId,
        qty,
        consumeRemarks.trim() || undefined
      );
      toast.success('Production consumption logged successfully!');
      setShowConsumeModal(false);
      setConsumeQty('');
      setConsumeRemarks('');
      await loadAccounting(selectedSc.id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to record consumption');
    } finally {
      setSubmittingConsume(false);
    }
  };

  const filteredScList = scList.filter(sc => {
    const q = searchQuery.toLowerCase();
    return sc.scNumber.toLowerCase().includes(q) || sc.productName.toLowerCase().includes(q);
  });

  // Totals for executive summary cards
  const totalRequired = accounting?.items.reduce((s, i) => s + (Number(i.required) || 0), 0) || 0;
  const totalIssued = accounting?.items.reduce((s, i) => s + (Number(i.issued) || 0), 0) || 0;
  const totalReceived = accounting?.items.reduce((s, i) => s + (Number(i.received) || 0), 0) || 0;
  const totalConsumed = accounting?.items.reduce((s, i) => s + (Number(i.consumed) || 0), 0) || 0;
  const totalReturned = accounting?.items.reduce((s, i) => s + (Number(i.returned) || 0), 0) || 0;
  const totalWipBalance = accounting?.items.reduce((s, i) => s + (Number(i.wip) || 0), 0) || 0;

  const overallConsumedPercent = totalIssued > 0 ? Math.round((totalConsumed / totalIssued) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Material Consumption & Accounting Report</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
              Report Module
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Complete material lifecycle audit statement for Raw Material creations: Issued, Consumed, Returned, and Shop Floor Balance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Report</span>
          </button>

          {(currentUser?.role === 'PRODUCTION' || currentUser?.role === 'ADMIN') && (
            <button
              onClick={() => {
                if (accounting?.items && accounting.items.length > 0) {
                  setConsumeItemId(accounting.items[0].rmItemId);
                }
                setShowConsumeModal(true);
              }}
              disabled={!selectedSc || !accounting || accounting.items.length === 0}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Log Daily Consumption</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Layout: SC Selection Drawer on left, Comprehensive Report on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Active Work Orders List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-[720px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-900 text-sm">Active RM Work Orders</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {scList.length}
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search SC or product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredScList.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No matching components found.</div>
            ) : (
              filteredScList.map((sc) => {
                const isSelected = selectedSc?.id === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => selectSc(sc)}
                    className={`w-full text-left p-3 rounded-lg transition-all text-xs ${
                      isSelected
                        ? 'bg-indigo-50/80 border border-indigo-200 text-slate-900 ring-1 ring-indigo-500/30'
                        : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 text-sm">{sc.scNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        sc.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                        sc.status === 'IN_PRODUCTION' ? 'bg-blue-100 text-blue-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {sc.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-slate-500 truncate">{sc.productName}</div>
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Target: {sc.targetQuantity} units</span>
                      {sc.purchaseOrder && <span>PO: {sc.purchaseOrder.poNumber}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Comprehensive Material Accounting Report */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSc ? (
            <>
              {/* Selected SC Banner */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-slate-900">SC: {selectedSc.scNumber}</h2>
                    <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {selectedSc.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Target Finished Product: <strong className="text-slate-800">{selectedSc.productName}</strong>
                    {selectedSc.purchaseOrder && <> (Linked PO: {selectedSc.purchaseOrder.poNumber})</>}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Consumption Rate</div>
                    <div className="text-base font-bold text-slate-900">{overallConsumedPercent}% Consumed</div>
                  </div>
                  <div className="w-16 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(overallConsumedPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Executive Material Accounting KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-slate-500">1. Required</div>
                  <div className="text-lg font-bold text-slate-900 mt-1">{totalRequired}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">From Requisition</div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-indigo-600">2. Issued (Stores)</div>
                  <div className="text-lg font-bold text-indigo-700 mt-1">{totalIssued}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Stores Dispatched</div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-blue-600">3. Received</div>
                  <div className="text-lg font-bold text-blue-700 mt-1">{totalReceived}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Floor Confirmed</div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-emerald-600">4. Consumed</div>
                  <div className="text-lg font-bold text-emerald-700 mt-1">{totalConsumed}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Used in Production</div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-amber-600">5. Returned</div>
                  <div className="text-lg font-bold text-amber-700 mt-1">{totalReturned}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sent Back to Stores</div>
                </div>

                <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
                  <div className="text-xs font-medium text-purple-600">6. Floor Balance</div>
                  <div className="text-lg font-bold text-purple-700 mt-1">{totalWipBalance}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Active WIP on Floor</div>
                </div>
              </div>

              {/* Item-by-Item Breakdown Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Boxes className="w-4 h-4 text-slate-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Raw Material Item Consumption Breakdown</h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    {accounting?.items.length || 0} Material Specification(s)
                  </span>
                </div>

                {loadingAccounting ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : !accounting || accounting.items.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No material items found for this component.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider">
                          <th className="py-3 px-4">Material Specification</th>
                          <th className="py-3 px-3 text-right">Required</th>
                          <th className="py-3 px-3 text-right text-indigo-700">Issued</th>
                          <th className="py-3 px-3 text-right text-blue-700">Received</th>
                          <th className="py-3 px-3 text-right text-emerald-700">Consumed</th>
                          <th className="py-3 px-3 text-right text-amber-700">Returned</th>
                          <th className="py-3 px-3 text-right text-purple-700">WIP Balance</th>
                          <th className="py-3 px-4 text-center">Utilization</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accounting.items.map((item) => {
                          const percent = item.issued > 0 ? Math.round((item.consumed / item.issued) * 100) : 0;
                          return (
                            <tr key={item.rmItemId} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900">{item.material}</div>
                                <div className="text-[11px] text-slate-500">
                                  Grade: {item.grade || 'Standard'} | Size: {item.size || 'N/A'}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-slate-700">{item.required}</td>
                              <td className="py-3 px-3 text-right font-bold text-indigo-700">{item.issued}</td>
                              <td className="py-3 px-3 text-right font-medium text-blue-700">{item.received}</td>
                              <td className="py-3 px-3 text-right font-bold text-emerald-700">{item.consumed}</td>
                              <td className="py-3 px-3 text-right font-medium text-amber-700">{item.returned}</td>
                              <td className="py-3 px-3 text-right font-bold text-purple-700">{item.wip}</td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-1.5 rounded-full"
                                      style={{ width: `${Math.min(percent, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] font-semibold text-slate-700">{percent}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Material Life Cycle Governance Note */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 flex items-start space-x-3">
                <FileText className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">Complete Traceability Compliance</div>
                  <p className="mt-0.5 text-slate-500">
                    This report verifies that all raw material allocations from Stores have been tracked across production receipt, machining consumption, and verified surplus returns. For extra material requisitions, consult the dedicated <strong>Extra Requests</strong> module. For physical surplus restitution, use the <strong>Return Verify</strong> module.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center text-slate-400">
              <Boxes className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <h3 className="text-base font-semibold text-slate-800">Select a Component</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose an active Sales Order Component from the left panel to inspect its complete material consumption report.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Log Daily Consumption Modal */}
      {showConsumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <PlaySquare className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Log Production Consumption</h3>
              </div>
              <button
                onClick={() => setShowConsumeModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordConsumption} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Component: {selectedSc?.scNumber}
                </label>
                <div className="text-xs text-slate-500 mb-2">{selectedSc?.productName}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Raw Material Item *
                </label>
                <select
                  value={consumeItemId}
                  onChange={(e) => setConsumeItemId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {accounting?.items.map((item) => (
                    <option key={item.rmItemId} value={item.rmItemId}>
                      {item.material} - (WIP Balance: {item.wip})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity Consumed in Shift *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  placeholder="e.g. 10"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Shift / Operator Remarks
                </label>
                <input
                  type="text"
                  value={consumeRemarks}
                  onChange={(e) => setConsumeRemarks(e.target.value)}
                  placeholder="e.g. Shift 1 production run completed"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConsumeModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConsume}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingConsume ? 'Logging...' : 'Confirm Consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
