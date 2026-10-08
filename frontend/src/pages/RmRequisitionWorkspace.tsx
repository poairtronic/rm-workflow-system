import { useState, useEffect } from 'react';
import { FileText, Edit, Clock, Plus, AlertCircle, Eye } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';

interface DraftItem {
  poId: string;
  poNumber: string;
  draftCount: number;
  submittedCount: number;
  scs: {
    scId: string;
    scNumber: string;
    productName: string;
    status: string;
    itemCount: number;
  }[];
  updatedAt: string;
}

export function RmRequisitionWorkspace() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMyRequisitions();
  }, []);

  const loadMyRequisitions = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getMine();
      // res.data is expected to be the array, or maybe res directly if api.get returns data
      const data = (res as any).data ?? res;
      setDrafts(data);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load requisitions.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (poId: string) => {
    window.location.href = `/design/rm-creation?poId=${poId}`;
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">Draft</span>;
      case 'SUBMITTED':
      case 'STORES_REVIEW':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-md">Submitted</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-md">{status}</span>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="My Requisitions"
        subtitle="Manage your Raw Material drafts and active requisitions."
        actionSlot={
          <button
            onClick={() => window.location.href = '/design/rm-creation'}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        }
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Requisitions Found</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            You haven't created any RM drafts or requisitions yet.
          </p>
          <button
            onClick={() => window.location.href = '/design/rm-creation'}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium hover:bg-indigo-100 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Draft</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {drafts.map((group) => (
            <div key={group.poId} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                    <span className="text-slate-500 mr-2">PO:</span>
                    {group.poNumber}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    Last updated: {new Date(group.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right mr-4">
                    <div className="text-sm font-medium text-slate-900">{group.scs.length} SCs</div>
                    <div className="text-xs text-slate-500">{group.draftCount} Draft, {group.submittedCount} Submitted</div>
                  </div>
                  {group.draftCount > 0 ? (
                    <button
                      onClick={() => handleEdit(group.poId)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Resume Draft</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEdit(group.poId)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View</span>
                    </button>
                  )}
                </div>
              </div>
              
              <div className="divide-y divide-slate-100">
                {group.scs.map((sc) => (
                  <div key={sc.scId} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-medium text-slate-900 mb-1">{sc.scNumber}</div>
                      <div className="text-sm text-slate-500">Product: {sc.productName} • {sc.itemCount} items</div>
                    </div>
                    <div>
                      {renderStatusBadge(sc.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
