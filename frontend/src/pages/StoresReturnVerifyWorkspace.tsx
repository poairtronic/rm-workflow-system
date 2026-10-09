import { useState, useEffect } from 'react';
import { 
  PackageCheck, 
  CheckCircle, 
  AlertCircle, 
  Send, 
  RotateCcw, 
  ShieldCheck
} from 'lucide-react';
import { workflowService, type SC, type MaterialAccounting } from '../services/workflowService';
import toast from 'react-hot-toast';
import { VerifyReturnModal } from '../components/modals/VerifyReturnModal';

export function StoresReturnVerifyWorkspace() {
  const [activeTab, setActiveTab] = useState<'VERIFY' | 'INITIATE'>('VERIFY');

  // Verify Tab State
  const [pendingReturns, setPendingReturns] = useState<any[]>([]);
  const [verifiedReturns, setVerifiedReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  // Initiate Return Tab State
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedScId, setSelectedScId] = useState<string>('');
  const [accounting, setAccounting] = useState<MaterialAccounting | null>(null);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});
  const [returnRemarks, setReturnRemarks] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    loadReturns();
    loadActiveScs();
  }, []);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const [pending, acked] = await Promise.all([
        workflowService.getReturns('PENDING_STORE_ACK'),
        workflowService.getReturns('ACKNOWLEDGED').catch(() => []),
      ]);
      setPendingReturns(pending as unknown as any[]);
      setVerifiedReturns(acked as unknown as any[]);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load material returns.');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveScs = async () => {
    try {
      const data = await workflowService.getScList();
      const inProd = data.filter(sc => 
        ['ISSUED', 'PARTIALLY_ISSUED', 'IN_PRODUCTION'].includes(sc.status)
      );
      setScList(inProd);
    } catch (err) {
      console.error('Failed to load active SCs', err);
    }
  };

  const handleSelectScForReturn = async (scId: string) => {
    setSelectedScId(scId);
    setReturnQtys({});
    if (!scId) {
      setAccounting(null);
      return;
    }
    try {
      const data = await workflowService.getAccounting(scId);
      setAccounting(data);
    } catch (err) {
      console.error('Failed to load accounting for return', err);
    }
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScId || !accounting) return;

    const itemsToReturn = accounting.items.filter(item => {
      const q = Number(returnQtys[item.rmItemId]);
      return q > 0;
    }).map(item => ({
      rmItemId: item.rmItemId,
      quantityReturned: Number(returnQtys[item.rmItemId])
    }));

    if (itemsToReturn.length === 0) {
      toast.error('Please enter at least one return quantity greater than zero.');
      return;
    }

    setSubmittingReturn(true);
    try {
      await workflowService.recordReturn(
        selectedScId,
        itemsToReturn,
        returnRemarks.trim() || 'Production surplus returned to Stores'
      );
      toast.success('Material return submitted to Stores for verification!');
      setSelectedScId('');
      setAccounting(null);
      setReturnQtys({});
      setReturnRemarks('');
      await loadReturns();
      setActiveTab('VERIFY');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to submit return');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleOpenVerifyModal = (ret: any) => {
    setSelectedReturn(ret);
  };

  if (selectedReturn) {
    return (
      <VerifyReturnModal
        isOpen={true}
        onClose={() => setSelectedReturn(null)}
        onSuccess={() => {
          setSelectedReturn(null);
          loadReturns();
          toast.success('Return verified and stock restored to warehouse bin!');
        }}
        returnId={selectedReturn.id}
        returnNumber={selectedReturn.returnNumber || selectedReturn.id.slice(0, 8)}
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-slate-900">Return & Stock Verification</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Stores & Production
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Return surplus raw material or scrap back to Stores, and verify returned inventory back into warehouse bins.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('VERIFY')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'VERIFY'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verify Returns Queue ({pendingReturns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('INITIATE')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'INITIATE'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            <span>Initiate Stock Return</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: INITIATE STOCK RETURN (FOR PRODUCTION) */}
      {activeTab === 'INITIATE' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Return Surplus Material to Stores</h2>
              <p className="text-xs text-slate-500">
                Send unused raw materials, off-cuts, or machining scrap back to Stores for verification and bin re-shelving.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitReturn} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Production Work Order (SC) *
                </label>
                <select
                  value={selectedScId}
                  onChange={(e) => handleSelectScForReturn(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select active SC...</option>
                  {scList.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.scNumber} - {sc.productName} ({sc.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Return Remarks / Condition Description
                </label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="e.g. Uncut prime length returned / setup scrap"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Material Items to Return */}
            {accounting && accounting.items.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Available Shop Floor Materials for SC: {accounting.scNumber}
                  </h3>
                  <span className="text-xs text-slate-500">Specify return quantity</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {accounting.items.map((item) => (
                    <div key={item.rmItemId} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{item.material}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Grade: {item.grade || 'Standard'} | Size: {item.size || 'N/A'}
                        </div>
                        <div className="flex items-center space-x-3 text-xs text-slate-600 mt-1.5">
                          <span>Issued: <strong className="text-indigo-600">{item.issued}</strong></span>
                          <span>Consumed: <strong className="text-emerald-600">{item.consumed}</strong></span>
                          <span>Already Returned: <strong className="text-amber-600">{item.returned}</strong></span>
                          <span>Available WIP: <strong className="text-purple-600">{item.wip}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          Return Qty:
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={item.wip > 0 ? item.wip : undefined}
                          value={returnQtys[item.rmItemId] || ''}
                          onChange={(e) => setReturnQtys({ ...returnQtys, [item.rmItemId]: e.target.value })}
                          placeholder="0.00"
                          className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm text-right font-bold focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={submittingReturn || !selectedScId}
                className="inline-flex items-center space-x-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {submittingReturn ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Return...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send Return to Stores</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: VERIFY RETURNS QUEUE (FOR STORES & ADMIN) */}
      {activeTab === 'VERIFY' && (
        <div className="space-y-6">
          {/* Pending Verification Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Returns Pending Stores Verification</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Materials physically returned from shop floor awaiting Stores acknowledgment and bin placement.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {pendingReturns.length} Pending
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : pendingReturns.length === 0 ? (
              <div className="text-center py-16">
                <PackageCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="text-base font-semibold text-slate-800">No Returns Pending</h4>
                <p className="text-xs text-slate-500 mt-1">All material returns have been verified and sheltered.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingReturns.map((ret) => (
                  <div key={ret.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          Return: {ret.returnNumber || ret.id.slice(0, 8)}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Pending Store Ack
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(ret.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700">
                        Component (SC): <strong className="text-slate-900">{ret.salesOrderComponent?.scNumber || 'N/A'}</strong>
                        {ret.salesOrderComponent?.productName && <> ({ret.salesOrderComponent.productName})</>}
                      </div>

                      {ret.remarks && (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 max-w-xl">
                          <strong>Remarks:</strong> {ret.remarks}
                        </div>
                      )}

                      {/* Items */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {ret.items?.map((it: any) => (
                          <span key={it.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                            {it.rmItem?.material || 'Material'}: <strong className="text-slate-900">{it.quantityReturned}</strong> returned
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleOpenVerifyModal(ret)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify & Place in Bin</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historical Verified Returns Section */}
          {verifiedReturns.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Verified Returns History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Audit ledger of returned materials acknowledged into warehouse inventory.</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                  {verifiedReturns.length} Acknowledged
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Return #</th>
                      <th className="py-3 px-4">Component (SC)</th>
                      <th className="py-3 px-4">Returned Materials</th>
                      <th className="py-3 px-4">Destination Bin</th>
                      <th className="py-3 px-4">Verified Date</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verifiedReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono font-medium text-slate-900">
                          {ret.returnNumber || ret.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {ret.salesOrderComponent?.scNumber || 'N/A'}
                        </td>
                        <td className="py-3 px-4">
                          {ret.items?.map((it: any) => (
                            <div key={it.id} className="text-slate-700">
                              {it.rmItem?.material || 'Material'}: <strong className="text-slate-900">{it.quantityReturned}</strong>
                            </div>
                          ))}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          {ret.destinationBin?.code || ret.destinationBinId?.slice(0, 8) || 'Restocked'}
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                          {new Date(ret.acknowledgedAt || ret.updatedAt).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Acknowledged
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
