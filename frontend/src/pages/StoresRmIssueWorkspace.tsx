import { useState, useEffect } from 'react';
import { PackageSearch, PackagePlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';
import { extractErrorMessage } from '../utils/extractErrorMessage';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';
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
    items?: {
      id: string;
      material: string;
      grade?: string;
      size?: string;
      quantity: number;
      partNumber?: string;
      partName?: string;
      description?: string;
      originalMaterial?: string;
      originalGrade?: string;
      originalQuantity?: number;
      mappedProductId?: string;
    }[];
    issuedItems?: {
      rmItemId: string;
      issuedProductId?: string;
      issuedProductName: string;
      requestedMaterial?: string;
      originalMaterial?: string;
      originalGrade?: string;
      originalQuantity?: number;
      quantityIssued: number;
      issueNumber?: string;
      issuedAt?: string;
    }[];
  }[];
  updatedAt: string;
}

export function StoresRmIssueWorkspace() {
  const [queues, setQueues] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  // Active issue selection
  const [selectedScForIssue, setSelectedScForIssue] = useState<{ id: string; num: string } | null>(null);

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
      const data = res as unknown as DraftItem[];
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
        subtitle="Review requested materials, substitute items if needed, and issue directly to production."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : queues.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
          <PackageSearch className="w-12 h-12 text-slate-400 mb-3" />
          <h3 className="text-lg font-bold text-slate-900 mb-1">No Material Requisitions Pending Issue</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            All submitted raw material requisitions have been fulfilled or no new requisitions are submitted.
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
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
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
                        Stores Issued Partially
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

                      {/* Line Items Details: Original Requested vs Actual Issued */}
                      {sc.items && sc.items.length > 0 ? (
                        <div className="mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/30">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                              <tr>
                                <th className="py-2.5 px-3">Original Requested Product</th>
                                <th className="py-2.5 px-3">Spec / Grade</th>
                                <th className="py-2.5 px-3">Description</th>
                                <th className="py-2.5 px-3 text-right">Required Qty</th>
                                <th className="py-2.5 px-3">Actual Issued Product</th>
                                <th className="py-2.5 px-3 text-right">Issued Qty</th>
                                <th className="py-2.5 px-3 text-right">Remaining</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/70 bg-white font-medium">
                              {sc.items.map((it) => {
                                const itemIssues = (sc.issuedItems || []).filter((iss) => iss.rmItemId === it.id);
                                const totalItemIssued = Math.round(
                                  itemIssues.reduce((sum, iss) => sum + Number(iss.quantityIssued || 0), 0) * 1000
                                ) / 1000;
                                const itemRemaining = Math.max(0, Math.round((Number(it.quantity) - totalItemIssued) * 1000) / 1000);

                                return (
                                  <tr key={it.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-2.5 px-3">
                                      <span className="font-bold text-slate-900">{it.originalMaterial || it.material}</span>
                                      {it.partNumber && (
                                        <span className="ml-1.5 text-[10px] text-indigo-600 font-mono font-bold">({it.partNumber})</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600">{it.originalGrade || it.grade || '—'}</td>
                                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={it.description || ''}>
                                      {it.description || '—'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-slate-800 tabular-nums">
                                      {it.quantity}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      {itemIssues.length > 0 ? (
                                        <div className="space-y-1">
                                          {itemIssues.map((iss, issIdx) => {
                                            const itemSubstituted =
                                              iss.issuedProductName &&
                                              iss.issuedProductName !== (it.originalMaterial || it.material);
                                            return (
                                              <div key={issIdx} className="flex items-center gap-1.5">
                                                <span className="font-semibold text-slate-900">{iss.issuedProductName}</span>
                                                {itemSubstituted && (
                                                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                                                    Substituted
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <span className="text-slate-400 italic">Not issued yet</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold text-indigo-600 tabular-nums">
                                      {totalItemIssued > 0 ? totalItemIssued : '0'}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-bold tabular-nums">
                                      <span className={itemRemaining > 0 ? 'text-purple-700' : 'text-emerald-700'}>
                                        {itemRemaining}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-600 mb-6 flex items-center justify-between">
                          <span>{sc.itemCount} Material Item(s) requested.</span>
                          {isScPartial && (
                            <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                              Remaining: {sc.remainingQuantity ?? (sc.totalRequired! - sc.totalIssued!)} units to issue
                            </span>
                          )}
                        </div>
                      )}
                      
                      <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4">
                        {sc.status === 'REJECTED' ? (
                          <span className="text-xs text-red-600 font-medium italic">Requisition Rejected by Stores</span>
                        ) : isScFullyIssued ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" />
                            <span>Material Fully Issued</span>
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

      {/* Reject Reason Modal */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Reject RM Requisition</h3>
            <p className="text-xs text-slate-500">
              Please enter the reason for rejecting requisition for SC <strong>{rejectTarget.scNumber}</strong>. The Designer will be notified.
            </p>
            <textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              placeholder="e.g. Requested material grade is obsolete or unavailable..."
              className="w-full h-24 p-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setRejectTarget(null);
                  setRejectRemarks('');
                }}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectRequisition}
                disabled={submittingReject || !rejectRemarks.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-xs disabled:opacity-50"
              >
                {submittingReject ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
