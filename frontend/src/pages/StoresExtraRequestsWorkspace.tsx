import { useState, useEffect } from 'react';
import { FilePlus, Check, X, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';
import toast from 'react-hot-toast';
import { IssueMaterialModal } from '../components/modals/IssueMaterialModal';

export function StoresExtraRequestsWorkspace() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedReqForIssue, setSelectedReqForIssue] = useState<any>(null);

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
      toast.error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await workflowService.rejectAdditionalRequest(id);
      toast.success('Request rejected successfully');
      loadRequests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject');
    }
  };

  const handleOpenIssueModal = (req: any) => {
    setSelectedReqForIssue(req);
  };

  if (selectedReqForIssue) {
    return (
      <IssueMaterialModal
        isOpen={true}
        onClose={() => {
          setSelectedReqForIssue(null);
        }}
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
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Extra Material Requests"
        subtitle="Review and approve additional material requests from Production."
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
      ) : requests.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <FilePlus className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Requests Found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            There are no pending extra material requests.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">Request: {req.requestNumber}</h4>
                  <p className="text-sm text-slate-500">SC: {req.salesOrderComponent?.scNumber}</p>
                </div>
                <div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-md ${
                    req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    req.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                    req.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {req.status}
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p><strong>Remarks:</strong> {req.remarks || 'None'}</p>
              </div>

              <div className="flex-1 space-y-2 mb-4">
                <h5 className="font-semibold text-slate-900 text-sm">Requested Items:</h5>
                {req.items.map((item: any) => (
                  <div key={item.id} className="text-sm text-slate-600 flex justify-between bg-white border border-slate-200 p-2 rounded">
                    <span>{item.material}</span>
                    <span className="font-medium">{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4 mt-auto">
                {req.status === 'PENDING' && (
                  <>
                    <button
                      onClick={() => handleReject(req.id)}
                      className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 font-medium rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => handleApprove(req.id)}
                      className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-medium rounded-lg transition-colors shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve</span>
                    </button>
                  </>
                )}
                {req.status === 'APPROVED' && (
                  <button 
                    onClick={() => handleOpenIssueModal(req)}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Issue Material (Additional Request)</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
