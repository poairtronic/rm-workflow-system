import { useState, useEffect } from 'react';
import { PackageSearch, FileText, PackagePlus, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';
import { ReviewMappingWorkspace } from './ReviewMappingWorkspace';
import { StatusBadge } from '../components/ui/StatusBadge';
import { getCanonicalStage } from '../utils/canonicalStages';

interface DraftItem {
  poId: string;
  poNumber: string;
  scs: {
    rmId?: string;
    scId: string;
    scNumber: string;
    productName: string;
    status: string; // RmRequestStatus
    scStatus: string; // ScStatus
    itemCount: number;
    totalRequired?: number;
    totalIssued?: number;
    remainingQuantity?: number;
    isFullyIssued?: boolean;
    isPartiallyIssued?: boolean;
  }[];
  updatedAt: string;
}

// Phase 2 & 3: Direct issue workspace with smart bin auto-filtering and PO completion
export function StoresRmIssueWorkspace() {
  const [queues, setQueues] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Active issue selection
  const [selectedScForIssue, setSelectedScForIssue] = useState<{ id: string; num: string } | null>(null);

  // Active review mapping selection
  const [selectedScForReview, setSelectedScForReview] = useState<{
    scId: string;
    scNumber: string;
    poNumber: string;
    productName: string;
    rmId?: string;
  } | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<{ rmId: string; scNumber: string } | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getStoresQueue();
      const data = res as unknown as DraftItem[]; // api returns T which is any[]
      setQueues(data);
      if (data.length > 0 && !selectedPoId) {
        setSelectedPoId(data[0].poId);
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load RM queue.');
    } finally {
      setLoading(false);
    }
  };

  const renderStatusBadge = (status: string) => {
    const canonical = getCanonicalStage(status);
    return <StatusBadge status={canonical} />;
  };

  const handleRejectRequisition = async () => {
    if (!rejectTarget || !rejectTarget.rmId) return;
    if (!rejectRemarks.trim()) {
      alert('Please provide a reason for rejection.');
      return;
    }
    setSubmittingReject(true);
    try {
      await workflowService.rejectRm(rejectTarget.rmId, rejectRemarks.trim());
      setRejectTarget(null);
      setRejectRemarks('');
      await loadQueue();
    } catch (err: any) {
      alert(extractErrorMessage(err, 'Failed to reject requisition'));
    } finally {
      setSubmittingReject(false);
    }
  };

  const handleOpenIssueModal = (scId: string, scNumber: string) => {
    setSelectedScForIssue({ id: scId, num: scNumber });
  };

  const checkIsScFullyIssued = (sc: DraftItem['scs'][0]) => {
    if (sc.isFullyIssued !== undefined) return sc.isFullyIssued;
    if (sc.totalRequired !== undefined && sc.totalIssued !== undefined) {
      return sc.totalRequired > 0 && sc.totalIssued >= sc.totalRequired;
    }
    return sc.scStatus === 'ISSUED' || sc.scStatus === 'COMPLETED';
  };

  const checkIsScPartiallyIssued = (sc: DraftItem['scs'][0]) => {
    if (sc.isPartiallyIssued !== undefined) return sc.isPartiallyIssued;
    if (sc.totalRequired !== undefined && sc.totalIssued !== undefined) {
      return sc.totalIssued > 0 && sc.totalIssued < sc.totalRequired;
    }
    return sc.scStatus === 'PARTIALLY_ISSUED';
  };

  const selectedPo = queues.find((q) => q.poId === selectedPoId);
  const poCompletedCount = selectedPo
    ? selectedPo.scs.filter((s) => checkIsScFullyIssued(s)).length
    : 0;
  const isSelectedPoCompleted = selectedPo
    ? selectedPo.scs.length > 0 && poCompletedCount === selectedPo.scs.length
    : false;
  const isSelectedPoPartial = selectedPo
    ? !isSelectedPoCompleted && selectedPo.scs.some((s) => checkIsScPartiallyIssued(s) || ((s.totalIssued || 0) > 0))
    : false;

  if (selectedScForReview) {
    return (
      <ReviewMappingWorkspace
        scId={selectedScForReview.scId}
        scNumber={selectedScForReview.scNumber}
        poNumber={selectedScForReview.poNumber}
        productName={selectedScForReview.productName}
        rmId={selectedScForReview.rmId}
        onBack={() => {
          setSelectedScForReview(null);
          loadQueue();
        }}
        onSuccess={() => {
          loadQueue();
        }}
        onProceedToIssue={(scId, scNumber) => {
          setSelectedScForReview(null);
          setSelectedScForIssue({ id: scId, num: scNumber });
        }}
      />
    );
  }

  if (selectedScForIssue) {
    return (
      <IssueMaterialModal
        isOpen={true}
        onClose={() => {
          setSelectedScForIssue(null);
        }}
        onSuccess={() => {
          setSelectedScForIssue(null);
          loadQueue();
        }}
        scId={selectedScForIssue.id}
        scNumber={selectedScForIssue.num}
      />
    );
  }

  return (
    <div className="w-full h-[calc(100vh-8rem)] flex flex-col space-y-6">
      <PageHeader
        title="RM Issue Queue"
        subtitle="Review RM mappings and issue material to production."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : queues.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <PackageSearch className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">Queue is Empty</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            There are no submitted RM requests waiting for review or issue.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden space-x-6">
          {/* PO List Pane */}
          <div className="w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-900">Purchase Orders</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {queues.map((po) => {
                const isPoCompleted = po.scs.length > 0 && po.scs.every(s => checkIsScFullyIssued(s));
                const isPoPartial = !isPoCompleted && po.scs.some(s => checkIsScPartiallyIssued(s) || ((s.totalIssued || 0) > 0));

                return (
                  <button
                    key={po.poId}
                    onClick={() => setSelectedPoId(po.poId)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPoId === po.poId
                        ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500'
                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-900">{po.poNumber}</span>
                      {isPoCompleted ? (
                        <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                          Stores Issued
                        </span>
                      ) : isPoPartial ? (
                        <span className="text-xs bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-full">
                          Stores Issued Partially
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                          Stores Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{po.scs.length} Component{po.scs.length > 1 ? 's' : ''}</span>
                      <span>{new Date(po.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SC Cards Pane */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedPo ? (
              <div className="bg-slate-50 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
                <div className="p-5 border-b border-slate-200 bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">PO: {selectedPo.poNumber}</h3>
                      <p className="text-sm text-slate-500 mt-1">Select an SC below to issue raw materials directly to production.</p>
                    </div>
                    {isSelectedPoCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-blue-100 text-blue-800 rounded-full border border-blue-300">
                        Stores Issued ({poCompletedCount}/{selectedPo.scs.length} SCs)
                      </span>
                    ) : isSelectedPoPartial ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-purple-100 text-purple-800 rounded-full border border-purple-300">
                        Stores Issued Partially ({poCompletedCount}/{selectedPo.scs.length} SCs Completed)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                        Stores Pending ({selectedPo.scs.length} SCs)
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {selectedPo.scs.map((sc) => {
                    const isScFullyIssued = checkIsScFullyIssued(sc);
                    const isScPartial = checkIsScPartiallyIssued(sc);

                    return (
                    <div key={sc.scId} className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-bold text-lg text-slate-900">{sc.scNumber}</h4>
                          <p className="text-sm text-slate-500">Product: {sc.productName}</p>
                        </div>
                        <div>
                          {isScPartial ? (
                            <span className="px-2.5 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-md border border-purple-200">
                              Stores Issued Partially ({sc.totalIssued || 0}/{sc.totalRequired || 0})
                            </span>
                          ) : isScFullyIssued ? (
                            <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-md border border-blue-200">
                              Stores Issued
                            </span>
                          ) : (
                            renderStatusBadge(sc.scStatus === 'PARTIALLY_ISSUED' ? sc.scStatus : sc.status)
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-slate-600 mb-6 flex items-center justify-between">
                        <span>{sc.itemCount} Material Item(s) requested.</span>
                        {isScPartial && (
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                            Remaining: {sc.remainingQuantity ?? (sc.totalRequired! - sc.totalIssued!)} units to issue
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4">
                        {sc.status === 'REJECTED' ? (
                          <span className="text-xs text-red-600 font-medium italic">Requisition Rejected by Stores</span>
                        ) : isScFullyIssued ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                            ✓ Material Fully Issued
                          </span>
                        ) : (
                          <div className="flex items-center space-x-3">
                            {sc.status === 'SUBMITTED' && (
                              <button
                                onClick={() => setRejectTarget({ rmId: sc.rmId || '', scNumber: sc.scNumber })}
                                className="px-3 py-2 text-sm text-red-700 hover:bg-red-50 font-medium rounded-lg border border-red-200 transition-colors cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                            <button 
                              onClick={() => setSelectedScForReview({
                                scId: sc.scId,
                                scNumber: sc.scNumber,
                                poNumber: selectedPo.poNumber,
                                productName: sc.productName,
                                rmId: sc.rmId,
                              })}
                              className="flex items-center space-x-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 font-medium rounded-lg transition-colors cursor-pointer"
                              title="View or modify inventory mapping"
                            >
                              <FileText className="w-4 h-4" />
                              <span>Mapping</span>
                            </button>
                            <button 
                              onClick={() => handleOpenIssueModal(sc.scId, sc.scNumber)}
                              className={`flex items-center space-x-2 px-4 py-2 text-white font-medium rounded-lg transition-colors shadow-sm cursor-pointer ${
                                isScPartial ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              <PackagePlus className="w-4 h-4" />
                              <span>{isScPartial ? 'Issue Remaining Material' : 'Issue Material'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-slate-500">Select a Purchase Order to view its Sales Order Components.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reject Requisition Modal Dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Reject RM Requisition</h3>
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to reject the Raw Material Requisition for SC <strong>{rejectTarget.scNumber}</strong>? Production will be informed with your reason.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Reason for Rejection *
              </label>
              <textarea
                rows={3}
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="e.g. Stock unavailable, Material grade mismatch, Needs supervisor approval"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequisition}
                disabled={submittingReject || !rejectRemarks.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
