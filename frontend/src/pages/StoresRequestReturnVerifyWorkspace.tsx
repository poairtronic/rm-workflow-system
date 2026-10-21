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
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Layers,
  Inbox
} from 'lucide-react';
import { workflowService } from '../services/workflowService';
import toast from 'react-hot-toast';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';
import { VerifyReturnModal } from '../components/modals/VerifyReturnModal';
import { useAuth } from '../contexts/AuthContext';

export function StoresRequestReturnVerifyWorkspace() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'RECEIVE' | 'ISSUE'>('RECEIVE');

  // Returns State (Tab 1: Receive)
  const [returns, setReturns] = useState<any[]>([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED'>('ALL');
  const [selectedReturnForVerify, setSelectedReturnForVerify] = useState<any>(null);

  // Extra Requests State (Tab 2: Issue)
  const [requests, setRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestSearchQuery, setRequestSearchQuery] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'ISSUED' | 'REJECTED'>('ALL');
  const [selectedReqForIssue, setSelectedReqForIssue] = useState<any>(null);
  const [rejectDialogReqId, setRejectDialogReqId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setError(null);
    await Promise.all([loadReturns(), loadRequests()]);
  };

  const loadReturns = async () => {
    setLoadingReturns(true);
    try {
      const data = await workflowService.getReturns();
      setReturns(data || []);
    } catch (err: any) {
      console.error('Failed to load returns', err);
      setError('Failed to load material returns queue.');
    } finally {
      setLoadingReturns(false);
    }
  };

  const loadRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await workflowService.getAdditionalRequests();
      setRequests((res as unknown as any[]) || []);
    } catch (err: any) {
      console.error('Failed to load extra requests', err);
      setError('Failed to load extra material requests queue.');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      await workflowService.approveAdditionalRequest(id);
      toast.success('Extra request approved');
      loadRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve request');
    }
  };

  const handleConfirmRejectRequest = async () => {
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

  // Filtered Returns
  const filteredReturns = returns.filter((ret) => {
    const isPending = ret.status === 'PENDING_STORE_ACK' || ret.status === 'PENDING';
    const isAck = ret.status === 'ACKNOWLEDGED';

    const matchesStatus =
      returnStatusFilter === 'ALL' ||
      (returnStatusFilter === 'PENDING' && isPending) ||
      (returnStatusFilter === 'ACKNOWLEDGED' && isAck);

    const q = returnSearchQuery.toLowerCase();
    const retNum = (ret.returnNumber || ret.id || '').toLowerCase();
    const scNum = (ret.salesOrderComponent?.scNumber || '').toLowerCase();
    const poNum = (ret.salesOrderComponent?.purchaseOrder?.poNumber || '').toLowerCase();
    const remarks = (ret.remarks || '').toLowerCase();
    const itemMatch = ret.items?.some((i: any) =>
      (i.rmItem?.material || i.material || '').toLowerCase().includes(q)
    );

    return matchesStatus && (!q || retNum.includes(q) || scNum.includes(q) || poNum.includes(q) || remarks.includes(q) || itemMatch);
  });

  // Filtered Requests
  const filteredRequests = requests.filter((req) => {
    const matchesStatus =
      requestStatusFilter === 'ALL' ||
      (requestStatusFilter === 'REQUESTED' && (req.status === 'PENDING' || req.status === 'REQUESTED')) ||
      req.status === requestStatusFilter;

    const q = requestSearchQuery.toLowerCase();
    const scNum = req.salesOrderComponent?.scNumber?.toLowerCase() || '';
    const poNum = req.salesOrderComponent?.purchaseOrder?.poNumber?.toLowerCase() || '';
    const reqNum = req.requestNumber?.toLowerCase() || '';
    const remarks = req.remarks?.toLowerCase() || '';
    const itemsMatch = req.items?.some((i: any) =>
      (i.rmItem?.material || i.material || '').toLowerCase().includes(q)
    );

    return matchesStatus && (!q || scNum.includes(q) || poNum.includes(q) || reqNum.includes(q) || remarks.includes(q) || itemsMatch);
  });

  const isStoresOrAdmin = currentUser?.role === 'STORES' || currentUser?.role === 'ADMIN';

  // Counts for tabs
  const pendingReturnsCount = returns.filter(
    (r) => r.status === 'PENDING_STORE_ACK' || r.status === 'PENDING'
  ).length;
  const pendingRequestsCount = requests.filter(
    (r) => r.status === 'PENDING' || r.status === 'REQUESTED'
  ).length;

  // Active Issue Modal
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

  // Active Return Verification Modal
  if (selectedReturnForVerify) {
    return (
      <VerifyReturnModal
        isOpen={true}
        onClose={() => setSelectedReturnForVerify(null)}
        onSuccess={() => {
          setSelectedReturnForVerify(null);
          loadReturns();
        }}
        returnId={selectedReturnForVerify.id}
        returnNumber={selectedReturnForVerify.returnNumber || selectedReturnForVerify.id.slice(0, 8)}
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-indigo-600" />
            RM Request & Return Verify
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Stores fulfillment portal: receive returned surplus stock into warehouse bins, and issue extra parts requested by Production.
          </p>
        </div>
        <button
          onClick={loadAllData}
          className="inline-flex items-center space-x-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${(loadingReturns || loadingRequests) ? 'animate-spin' : ''}`} />
          <span>Refresh All</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary Tab Switcher */}
      <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-[#1e233d] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab('RECEIVE')}
          className={`flex items-center space-x-2.5 px-5 py-3 rounded-t-xl font-bold text-sm transition-all relative border-b-2 cursor-pointer ${
            activeTab === 'RECEIVE'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-xs'
              : 'border-transparent bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#161a2e]'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>1. Receive Returns</span>
          {pendingReturnsCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white">
              {pendingReturnsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ISSUE')}
          className={`flex items-center space-x-2.5 px-5 py-3 rounded-t-xl font-bold text-sm transition-all relative border-b-2 cursor-pointer ${
            activeTab === 'ISSUE'
              ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 shadow-xs'
              : 'border-transparent bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#161a2e]'
          }`}
        >
          <ArrowUpRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>2. Issue Extra Requests</span>
          {pendingRequestsCount > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-black bg-indigo-600 text-white">
              {pendingRequestsCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: RECEIVE RETURNS (PRODUCTION SURPLUS INWARD TO STORES) */}
      {activeTab === 'RECEIVE' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header Controls */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-[16px] flex items-center gap-2">
                <Inbox className="w-4 h-4 text-emerald-600" />
                Production Returns Awaiting Store Receipt
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Inspect physical parts returned from the shop floor, select restock bin, and click &quot;Receive to Stock&quot;.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search Return #, SC, Material..."
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
                {(['ALL', 'PENDING', 'ACKNOWLEDGED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setReturnStatusFilter(st)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      returnStatusFilter === st
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'PENDING' ? 'Pending Receipt' : st === 'ACKNOWLEDGED' ? 'Verified / Restocked' : 'All'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingReturns ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-16">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-[16px] font-semibold text-slate-800">No Returns Pending</h4>
              <p className="text-xs text-slate-500 mt-1">
                {returnSearchQuery || returnStatusFilter !== 'ALL'
                  ? 'No return records match your search filter.'
                  : 'No materials are currently pending return from Production.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left border-collapse text-sm">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[260px]" />
                  <col className="w-[250px]" />
                  <col className="w-[100px]" />
                  <col className="w-[240px]" />
                  <col className="w-[130px]" />
                  <col className="w-[170px]" />
                  <col className="w-[150px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Work Order (SC / PO)</th>
                    <th className="py-3 px-4">Returned Material</th>
                    <th className="py-3 px-4 text-center">Return Qty</th>
                    <th className="py-3 px-4">Production Remarks</th>
                    <th className="py-3 px-4">Return Date</th>
                    <th className="py-3 px-4 text-center">Receipt Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReturns.map((ret) => {
                    const isPending = ret.status === 'PENDING_STORE_ACK' || ret.status === 'PENDING';
                    const isAck = ret.status === 'ACKNOWLEDGED';

                    const totalQty = ret.items?.reduce(
                      (sum: number, it: any) => sum + (Number(it.quantityReturned || it.quantity) || 0),
                      0
                    ) || 0;

                    const dateObj = new Date(ret.createdAt);
                    const formattedDate = dateObj.toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={ret.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Return # */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700 text-xs align-top">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono text-[11px] font-semibold border border-slate-200">
                            #{ret.returnNumber || ret.id.slice(0, 8)}
                          </span>
                        </td>

                        {/* 2. Work Order (SC / PO) */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 font-mono text-xs tracking-tight">
                              {ret.salesOrderComponent?.scNumber || 'Direct SC'}
                            </div>
                            {ret.salesOrderComponent?.purchaseOrder?.poNumber && (
                              <div className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">
                                PO: {ret.salesOrderComponent.purchaseOrder.poNumber}
                              </div>
                            )}
                            {ret.salesOrderComponent?.productName && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[240px]" title={ret.salesOrderComponent.productName}>
                                {ret.salesOrderComponent.productName}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Returned Material & Condition */}
                        <td className="py-3.5 px-4 align-top">
                          {ret.items && ret.items.length > 0 ? (
                            <div className="space-y-1.5">
                              {ret.items.map((it: any) => {
                                const matName = it.rmItem?.material || it.material || 'Material Part';
                                const condition = (it.condition || 'REUSABLE').toUpperCase();
                                return (
                                  <div key={it.id} className="text-xs">
                                    <div className="font-bold text-slate-900 leading-tight">{matName}</div>
                                    <div className="mt-1">
                                      <span
                                        className={`inline-block text-[10px] font-black px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                          condition === 'SCRAP'
                                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                                            : condition === 'DAMAGED'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        }`}
                                      >
                                        {condition}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not specified</span>
                          )}
                        </td>

                        {/* 4. Return Qty (Centered) */}
                        <td className="py-3.5 px-4 text-center align-top">
                          <span className="inline-flex items-center justify-center min-w-[2.4rem] h-7 px-2 font-black text-xs rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                            {totalQty}
                          </span>
                        </td>

                        {/* 5. Production Remarks */}
                        <td className="py-3.5 px-4 align-top">
                          <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed" title={ret.remarks}>
                            {ret.remarks || 'Standard production surplus return'}
                          </p>
                        </td>

                        {/* 6. Return Date */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-medium text-xs text-slate-800">{formattedDate}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{formattedTime}</div>
                        </td>

                        {/* 7. Receipt Status */}
                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending Receipt
                            </span>
                          ) : isAck ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Check className="w-3 h-3 mr-1" />
                              Restocked in Stores
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                              {ret.status}
                            </span>
                          )}
                        </td>

                        {/* 8. Action */}
                        <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                          {isStoresOrAdmin && isPending ? (
                            <button
                              onClick={() => setSelectedReturnForVerify(ret)}
                              className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
                            >
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                              <span>Receive to Stock</span>
                            </button>
                          ) : isAck ? (
                            <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                              <Check className="w-3 h-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ISSUE EXTRA REQUESTS (SHOP FLOOR EXTRA REQUIREMENTS) */}
      {activeTab === 'ISSUE' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* Header Controls */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-[16px] flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Extra Material Requests from Shop Floor
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Production requisitions for tooling scrap, defect replacements, or extra hardware. Allocate smart bins and issue.
              </p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search SC, PO, Material..."
                  value={requestSearchQuery}
                  onChange={(e) => setRequestSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-xs">
                {(['ALL', 'REQUESTED', 'APPROVED', 'ISSUED', 'REJECTED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setRequestStatusFilter(st)}
                    className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                      requestStatusFilter === st
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

          {loadingRequests ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-16">
              <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-[16px] font-semibold text-slate-800">No Extra Requests Found</h4>
              <p className="text-xs text-slate-500 mt-1">
                {requestSearchQuery || requestStatusFilter !== 'ALL'
                  ? 'No requests match your current search and filter criteria.'
                  : 'All incoming production requisitions have been fulfilled.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1240px] text-left border-collapse text-sm">
                <colgroup>
                  <col className="w-[110px]" />
                  <col className="w-[260px]" />
                  <col className="w-[250px]" />
                  <col className="w-[100px]" />
                  <col className="w-[240px]" />
                  <col className="w-[130px]" />
                  <col className="w-[170px]" />
                  <col className="w-[170px]" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap">
                    <th className="py-3 px-4">Request #</th>
                    <th className="py-3 px-4">Work Order (SC / PO)</th>
                    <th className="py-3 px-4">Requested Material</th>
                    <th className="py-3 px-4 text-center">Extra Qty</th>
                    <th className="py-3 px-4">Reason & Notes</th>
                    <th className="py-3 px-4">Requested Date</th>
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

                    const dateObj = new Date(req.createdAt);
                    const formattedDate = dateObj.toLocaleDateString(undefined, {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Request # */}
                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700 text-xs align-top">
                          <span className="inline-block bg-slate-100 text-slate-700 px-2 py-1 rounded font-mono text-[11px] font-semibold border border-slate-200">
                            #{req.requestNumber || req.id.slice(0, 8)}
                          </span>
                        </td>

                        {/* 2. Work Order (SC / PO) */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 font-mono text-xs tracking-tight">
                              {req.salesOrderComponent?.scNumber || 'N/A'}
                            </div>
                            {req.salesOrderComponent?.poNumber && (
                              <div className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">
                                PO: {req.salesOrderComponent.poNumber}
                              </div>
                            )}
                            {req.salesOrderComponent?.productName && (
                              <div className="text-[11px] text-slate-500 truncate max-w-[240px]" title={req.salesOrderComponent.productName}>
                                {req.salesOrderComponent.productName}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* 3. Requested Material / Item */}
                        <td className="py-3.5 px-4 align-top">
                          {req.items && req.items.length > 0 ? (
                            <div className="space-y-1.5">
                              {req.items.map((it: any) => {
                                const matName = it.rmItem?.material || it.material || 'Special Product';
                                const grade = it.rmItem?.grade;
                                const size = it.rmItem?.size;
                                return (
                                  <div key={it.id} className="text-xs">
                                    <div className="font-bold text-slate-900 leading-tight">{matName}</div>
                                    {(grade || size) && (
                                      <div className="text-slate-500 text-[11px] mt-0.5">
                                        {[grade, size].filter(Boolean).join(' • ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not specified</span>
                          )}
                        </td>

                        {/* 4. Extra Qty (Centered) */}
                        <td className="py-3.5 px-4 text-center align-top">
                          <span className="inline-flex items-center justify-center min-w-[2.4rem] h-7 px-2 font-black text-xs rounded-lg bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                            {totalExtraQty}
                          </span>
                        </td>

                        {/* 5. Reason & Notes */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-xs font-bold text-slate-800">
                            {req.reason ? req.reason.replace(/_/g, ' ') : 'Additional Requirement'}
                          </div>
                          {req.remarks && (
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mt-0.5" title={req.remarks}>
                              {req.remarks}
                            </p>
                          )}
                        </td>

                        {/* 6. Requested Date */}
                        <td className="py-3.5 px-4 align-top whitespace-nowrap">
                          <div className="font-medium text-xs text-slate-800">{formattedDate}</div>
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5">{formattedTime}</div>
                        </td>

                        {/* 7. Status */}
                        <td className="py-3.5 px-4 text-center align-top whitespace-nowrap">
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

                        {/* 8. Action */}
                        <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                          <div className="flex items-center justify-end space-x-2">
                            {isStoresOrAdmin && (isPending || isApproved) && (
                              <>
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => setRejectDialogReqId(req.id)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors cursor-pointer"
                                    >
                                      Reject
                                    </button>
                                    <button
                                      onClick={() => handleApproveRequest(req.id)}
                                      className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setSelectedReqForIssue(req)}
                                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
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
      )}

      {/* Reject Modal */}
      {rejectDialogReqId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Reject Extra Material Request</h3>
              <button
                onClick={() => setRejectDialogReqId(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
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
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRejectRequest}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
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
