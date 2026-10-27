import { useState, useEffect } from 'react';
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Boxes, 
  Search,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { workflowService } from '../services/workflowService';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import toast from 'react-hot-toast';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';
import { useAuth } from '../contexts/AuthContext';

export function StoresExtraRequestsWorkspace() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED'>('ALL');

  // Issue modal
  const [selectedReqForIssue, setSelectedReqForIssue] = useState<any>(null);

  // Reject dialog
  const [rejectDialogReqId, setRejectDialogReqId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
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

  const handleApprove = async (id: string) => {
    try {
      await workflowService.approveAdditionalRequest(id);
      toast.success('Request approved successfully');
      loadRequests();
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to approve request'));
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
      toast.error(extractErrorMessage(err, 'Failed to reject request'));
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
    const poNum = req.salesOrderComponent?.poNumber?.toLowerCase() || '';
    const reqNum = req.requestNumber?.toLowerCase() || '';
    const remarks = req.remarks?.toLowerCase() || '';
    const itemsMatch = req.items?.some((i: any) => 
      (i.rmItem?.material || i.material || '').toLowerCase().includes(q)
    ) || false;

    return matchesStatus && (!q || scNum.includes(q) || poNum.includes(q) || reqNum.includes(q) || remarks.includes(q) || itemsMatch);
  });

  const isStoresOrAdmin = currentUser?.role === 'STORES' || currentUser?.role === 'ADMIN';

  // Metrics
  const pendingCount = requests.filter(r => r.status === 'PENDING' || r.status === 'REQUESTED').length;
  const approvedCount = requests.filter(r => r.status === 'APPROVED').length;
  const issuedCount = requests.filter(r => r.status === 'ISSUED').length;

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
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Layers className="w-7 h-7 text-indigo-600" />
            Extra Material Requests Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stores fulfillment queue for shop-floor extra material requisitions submitted by Production. Select smart bins and issue directly.
          </p>
        </div>
        <button
          onClick={loadRequests}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Fulfillment</p>
            <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Awaiting store issue / bin allocation</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Approved Queue</p>
            <p className="text-2xl font-black text-indigo-600 mt-1">{approvedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Ready for immediate bin dispatch</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issued to Floor</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{issuedCount}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Fulfilled and delivered to Production</p>
          </div>
          <div className="w-11 h-11 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* EXTRA REQUESTS FULFILLMENT TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-[16px]">Incoming Shop-Floor Requests</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Production requests routed directly to Stores for extra materials, pins, hardware, and defect replacements.
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search SC, PO, Material..."
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
            <h4 className="text-[16px] font-semibold text-slate-800">No Extra Requests in Queue</h4>
            <p className="text-xs text-slate-500 mt-1">
              {searchQuery || statusFilter !== 'ALL'
                ? 'No requests match your current search and filter criteria.'
                : 'All incoming production requisitions have been fulfilled.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Request #</th>
                  <th className="py-3 px-4">Component (SC / PO)</th>
                  <th className="py-3 px-4">Requested Material / Item</th>
                  <th className="py-3 px-4 text-right">Extra Qty</th>
                  <th className="py-3 px-4">Reason & Justification</th>
                  <th className="py-3 px-4">Requested Time</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'PENDING' || req.status === 'REQUESTED';
                  const isApproved = req.status === 'APPROVED';
                  const isIssued = req.status === 'ISSUED';
                  const isRejected = req.status === 'REJECTED';

                  const totalExtraQty = req.items?.reduce((sum: number, it: any) => {
                    const q = Number(it.quantityRequested ?? it.quantityApproved ?? it.quantity ?? 0);
                    return sum + q;
                  }, 0) || 0;

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-900 text-xs">
                        {req.requestNumber || req.id.slice(0, 8)}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {req.salesOrderComponent?.scNumber || 'N/A'}
                          {req.salesOrderComponent?.poNumber && (
                            <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                              PO: {req.salesOrderComponent.poNumber}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">
                          {req.salesOrderComponent?.productName || ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {req.items && req.items.length > 0 ? (
                          <div className="space-y-1">
                            {req.items.map((it: any) => {
                              const matName = it.rmItem?.material || it.material || 'Special Product';
                              const grade = it.rmItem?.grade;
                              const size = it.rmItem?.size;
                              return (
                                <div key={it.id} className="text-xs text-slate-700">
                                  <span className="font-semibold text-slate-900">{matName}</span>
                                  {(grade || size) && (
                                    <span className="text-slate-500 ml-1.5 text-[11px]">
                                      ({[grade, size].filter(Boolean).join(' • ')})
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Not specified</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="inline-block px-2.5 py-1 bg-amber-50 text-amber-900 font-bold text-xs rounded-md border border-amber-200">
                          {totalExtraQty}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-semibold text-slate-800">
                          {req.reason ? req.reason.replace(/_/g, ' ') : 'Additional Requirement'}
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
                          {isStoresOrAdmin && (isPending || isApproved) && (
                            <>
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => setRejectDialogReqId(req.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors"
                                  >
                                    Reject
                                  </button>
                                  <button
                                    onClick={() => handleApprove(req.id)}
                                    className="px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                                  >
                                    Approve
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => setSelectedReqForIssue(req)}
                                className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors inline-flex items-center space-x-1.5"
                              >
                                <Package className="w-3.5 h-3.5" />
                                <span>Issue Material</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </>
                          )}
                          {isIssued && (
                            <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              <Check className="w-3 h-3" />
                              Fulfilled
                            </span>
                          )}
                          {isRejected && (
                            <span className="text-xs text-red-600 font-medium">—</span>
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
