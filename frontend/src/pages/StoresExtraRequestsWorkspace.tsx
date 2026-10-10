import { useState, useEffect } from 'react';
import { 
  FilePlus, 
  Check, 
  X, 
  AlertCircle, 
  Search, 
  Send, 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Boxes, 
  Plus
} from 'lucide-react';
import { workflowService, type SC } from '../services/workflowService';
import toast from 'react-hot-toast';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';
import { useAuth } from '../contexts/AuthContext';

const REASON_OPTIONS = [
  { value: 'TOOL_WEAR_SCRAP', label: 'Tool Breakage / Machine Failure' },
  { value: 'DAMAGE', label: 'Raw Material Defect / Porosity / Damage' },
  { value: 'ADDITIONAL_REQUIREMENT', label: 'Engineering / Design Modification' },
  { value: 'WASTAGE', label: 'First Article / Sample Setup / Wastage' },
  { value: 'MANUFACTURING_ERROR', label: 'Machining Setup Scrap / Rework' },
  { value: 'OTHER', label: 'Other' },
];

export function StoresExtraRequestsWorkspace() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedScId, setSelectedScId] = useState<string>('');
  const [availableRmItems, setAvailableRmItems] = useState<any[]>([]);
  const [selectedRmItemId, setSelectedRmItemId] = useState<string>('');
  const [extraQuantity, setExtraQuantity] = useState<string>('');
  const [extraReason, setExtraReason] = useState<string>('MANUFACTURING_ERROR');
  const [extraRemarks, setExtraRemarks] = useState<string>('');
  const [submittingForm, setSubmittingForm] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(true);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED'>('ALL');

  // Issue modal
  const [selectedReqForIssue, setSelectedReqForIssue] = useState<any>(null);

  // Reject dialog
  const [rejectDialogReqId, setRejectDialogReqId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    loadActiveScs();
  }, []);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getAdditionalRequests();
      setRequests(res as unknown as any[]);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load extra requests.');
    } finally {
      setLoading(false);
    }
  };

  const loadActiveScs = async () => {
    try {
      const data = await workflowService.getScList();
      const eligible = data.filter(sc => 
        ['ISSUED', 'PARTIALLY_ISSUED', 'IN_PRODUCTION', 'STORES_PENDING', 'SUBMITTED', 'ADDITIONAL_REQUEST'].includes(sc.status)
      );
      setScList(eligible);
    } catch (err) {
      console.error('Failed to load SCs', err);
    }
  };

  // When user selects an SC in the form, load its RM items
  const handleSelectSc = async (scId: string) => {
    setSelectedScId(scId);
    setSelectedRmItemId('');
    setAvailableRmItems([]);
    if (!scId) return;

    try {
      const rmList = await workflowService.getRmList(scId);
      if (rmList && rmList.length > 0 && rmList[0].items) {
        setAvailableRmItems(rmList[0].items);
        if (rmList[0].items.length > 0) {
          setSelectedRmItemId(rmList[0].items[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load RM items for SC', err);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScId) {
      toast.error('Please select a Sales Order Component (SC)');
      return;
    }
    const qty = Number(extraQuantity);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid additional quantity (> 0)');
      return;
    }

    setSubmittingForm(true);
    try {
      await workflowService.createAdditionalRequest(
        selectedScId,
        [{
          rmItemId: selectedRmItemId || undefined,
          quantity: qty,
          remarks: extraRemarks.trim() || undefined
        }],
        extraReason,
        extraRemarks.trim() || undefined
      );

      toast.success('Extra Material Request submitted successfully to Stores!');
      // Reset form
      setExtraQuantity('');
      setExtraRemarks('');
      await loadRequests();
      await loadActiveScs();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to submit extra request');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await workflowService.approveAdditionalRequest(id);
      toast.success('Request approved successfully');
      loadRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectDialogReqId) return;
    try {
      await workflowService.rejectAdditionalRequest(rejectDialogReqId);
      toast.success('Request rejected');
      setRejectDialogReqId(null);
      loadRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject request');
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(req => {
    const matchesStatus = 
      statusFilter === 'ALL' || 
      (statusFilter === 'REQUESTED' && (req.status === 'PENDING' || req.status === 'REQUESTED')) ||
      req.status === statusFilter;

    const q = searchQuery.toLowerCase();
    const scNum = req.salesOrderComponent?.scNumber?.toLowerCase() || '';
    const reqNum = req.requestNumber?.toLowerCase() || '';
    const remarks = req.remarks?.toLowerCase() || '';
    const itemsMatch = req.items?.some((i: any) => i.material?.toLowerCase().includes(q)) || false;

    return matchesStatus && (!q || scNum.includes(q) || reqNum.includes(q) || remarks.includes(q) || itemsMatch);
  });

  const isStoresOrAdmin = currentUser?.role === 'STORES' || currentUser?.role === 'ADMIN';

  if (selectedReqForIssue) {
    return (
      <IssueMaterialModal
        isOpen={true}
        onClose={() => setSelectedReqForIssue(null)}
        onSuccess={() => {
          setSelectedReqForIssue(null);
          loadRequests();
        }}
        scId={selectedReqForIssue.scId}
        scNumber={selectedReqForIssue.salesOrderComponent?.scNumber || ''}
        additionalRequestId={selectedReqForIssue.id}
      />
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Extra Material Requests</h1>
          <p className="text-sm text-slate-500 mt-1">
            Request additional raw materials for active production jobs, and monitor real-time review & issue status.
          </p>
        </div>
        <button
          onClick={() => setShowRequestForm(!showRequestForm)}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>{showRequestForm ? 'Collapse Request Form' : 'New Extra Request'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP SECTION: REQUEST ADDITIONAL MATERIAL FORM */}
      {showRequestForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center space-x-2.5 mb-5 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <FilePlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Request Extra Raw Material</h2>
              <p className="text-xs text-slate-500">
                Submit an expedited requisition to Stores for tooling scrap, defect replacement, or setup wastage.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Select SC / Work Order */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Work Order (SC) *
                </label>
                <select
                  value={selectedScId}
                  onChange={(e) => handleSelectSc(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Select active SC...</option>
                  {scList.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.scNumber} - {sc.productName} ({sc.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Raw Material Item */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Raw Material Item *
                </label>
                <select
                  value={selectedRmItemId}
                  onChange={(e) => setSelectedRmItemId(e.target.value)}
                  disabled={!selectedScId || availableRmItems.length === 0}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">Select material item...</option>
                  {availableRmItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.material} - {item.grade || ''} ({item.size || ''}) [Orig Qty: {item.quantity}]
                    </option>
                  ))}
                </select>
                {selectedScId && availableRmItems.length === 0 && (
                  <span className="text-xs text-amber-600 mt-1 block">No RM items mapped on this SC.</span>
                )}
              </div>

              {/* Additional Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Additional Qty Required *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={extraQuantity}
                  onChange={(e) => setExtraQuantity(e.target.value)}
                  placeholder="e.g. 5"
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              {/* Justification Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Extra Request *
                </label>
                <select
                  value={extraReason}
                  onChange={(e) => setExtraReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Detailed Remarks */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Operational Justification / Shop Floor Notes
                </label>
                <input
                  type="text"
                  value={extraRemarks}
                  onChange={(e) => setExtraRemarks(e.target.value)}
                  placeholder="Explain reason for extra material (e.g. tool breakage resulted in 2 scrap pieces on machine 4)"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={submittingForm || !selectedScId || !extraQuantity}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingForm ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Request to Stores</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* BOTTOM SECTION: REAL-TIME EXTRA REQUESTS STATUS TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-[16px]">Extra Material Requests Status Ledger</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live tracking of all additional raw material requests with real-time approval and issue statuses.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search SC, Material, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
              {(['ALL', 'REQUESTED', 'APPROVED', 'ISSUED', 'REJECTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {st === 'REQUESTED' ? 'PENDING' : st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-16">
            <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-[16px] font-semibold text-slate-800">No Extra Requests Found</h4>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No requests match your current search and filter criteria.'
                : 'No additional material requests have been recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Component (SC)</th>
                  <th className="py-3 px-4">Requested Material</th>
                  <th className="py-3 px-4 text-right">Extra Qty</th>
                  <th className="py-3 px-4">Reason & Justification</th>
                  <th className="py-3 px-4">Requested Date</th>
                  <th className="py-3 px-4 text-center">Current Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'PENDING' || req.status === 'REQUESTED';
                  const isApproved = req.status === 'APPROVED';
                  const isIssued = req.status === 'ISSUED';
                  const isRejected = req.status === 'REJECTED';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 text-xs">
                        {req.requestNumber || req.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {req.salesOrderComponent?.scNumber || 'N/A'}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {req.salesOrderComponent?.productName || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.items && req.items.length > 0 ? (
                          <div className="space-y-1">
                            {req.items.map((it: any) => (
                              <div key={it.id} className="text-xs text-slate-700">
                                <span className="font-medium text-slate-900">{it.material}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not specified</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {req.items?.reduce((sum: number, it: any) => sum + (Number(it.quantity) || 0), 0) || 0}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {req.reason ? req.reason.replace(/_/g, ' ') : 'General Requirement'}
                        </div>
                        {req.remarks && (
                          <div className="text-xs text-slate-500 truncate max-w-sm" title={req.remarks}>
                            {req.remarks}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                        <div className="text-[10px] text-slate-400">
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {isPending && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending Review
                          </span>
                        )}
                        {isApproved && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approved (Ready)
                          </span>
                        )}
                        {isIssued && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Check className="w-3 h-3 mr-1" />
                            Issued by Stores
                          </span>
                        )}
                        {isRejected && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                            <XCircle className="w-3 h-3 mr-1" />
                            Rejected
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {isStoresOrAdmin && isPending && (
                            <>
                              <button
                                onClick={() => setRejectDialogReqId(req.id)}
                                className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
                              >
                                Reject
                              </button>
                              <button
                                onClick={() => handleApprove(req.id)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded shadow-xs transition-colors"
                              >
                                Approve
                              </button>
                            </>
                          )}
                          {isStoresOrAdmin && isApproved && (
                            <button
                              onClick={() => setSelectedReqForIssue(req)}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs transition-colors inline-flex items-center space-x-1"
                            >
                              <Package className="w-3.5 h-3.5" />
                              <span>Issue Material</span>
                            </button>
                          )}
                          {!isPending && !isApproved && (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          )}
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

      {/* Reject Modal */}
      {rejectDialogReqId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Reject Extra Material Request</h3>
              <button
                onClick={() => setRejectDialogReqId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to reject this extra material request? This will inform Production and close the request.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setRejectDialogReqId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
