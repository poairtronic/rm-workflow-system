import { useState, useEffect } from 'react';
import { FileText, Edit, Clock, Plus, AlertCircle, Eye, Search, X, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';

interface DraftItem {
  poId: string;
  poNumber: string;
  draftCount: number;
  submittedCount: number;
  rejectedCount?: number;
  scs: {
    scId: string;
    scNumber: string;
    productName: string;
    status: string;
    remarks?: string;
    itemCount: number;
    items?: {
      id: string;
      material: string;
      grade?: string;
      quantity: number;
      size?: string;
    }[];
  }[];
  updatedAt: string;
}

export function RmRequisitionWorkspace() {
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DRAFT' | 'SUBMITTED' | 'REJECTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal / Drawer for item inspection
  const [inspectSc, setInspectSc] = useState<{
    poNumber: string;
    scNumber: string;
    productName: string;
    status: string;
    remarks?: string;
    items: any[];
  } | null>(null);

  useEffect(() => {
    loadMyRequisitions();
  }, []);

  const loadMyRequisitions = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getMine();
      const data = (res as any).data ?? res;
      setDrafts(Array.isArray(data) ? data : []);
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
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">
            Draft
          </span>
        );
      case 'SUBMITTED':
      case 'STORES_REVIEW':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
            Stores Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-red-100 text-red-700 rounded-full border border-red-200 flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            <span>Rejected by Stores</span>
          </span>
        );
      case 'COMPLETED':
      case 'ISSUED':
        return (
          <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Material Issued</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700 rounded-full">
            {status}
          </span>
        );
    }
  };

  // Filter drafts based on tab & search
  const filteredDrafts = drafts.filter((group) => {
    const matchesSearch =
      group.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      group.scs.some(
        (sc) =>
          sc.scNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sc.productName.toLowerCase().includes(searchTerm.toLowerCase())
      );

    if (!matchesSearch) return false;

    if (activeTab === 'DRAFT') {
      return group.draftCount > 0;
    }
    if (activeTab === 'SUBMITTED') {
      return group.submittedCount > 0;
    }
    if (activeTab === 'REJECTED') {
      return (group.rejectedCount && group.rejectedCount > 0) || group.scs.some((sc) => sc.status === 'REJECTED');
    }
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="My Requisitions"
        subtitle="Track submitted RM requests, review Stores feedback, and revise drafts."
        actionSlot={
          <button
            onClick={() => (window.location.href = '/design/rm-creation')}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Requisition</span>
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-xl flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tab Controls */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All ({drafts.length})
          </button>
          <button
            onClick={() => setActiveTab('DRAFT')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'DRAFT'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Drafts ({drafts.filter((d) => d.draftCount > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('SUBMITTED')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'SUBMITTED'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Stores Review ({drafts.filter((d) => d.submittedCount > 0).length})
          </button>
          <button
            onClick={() => setActiveTab('REJECTED')}
            className={`flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'REJECTED'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-red-700 bg-red-50 hover:bg-red-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>
              Rejected ({drafts.filter((d) => (d.rejectedCount && d.rejectedCount > 0) || d.scs.some((s) => s.status === 'REJECTED')).length})
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search PO, SC, or Product..."
            className="w-full pl-9 pr-3.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Requisitions Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {searchTerm ? 'No results matched your search criteria.' : 'You have no raw material requisitions under this category.'}
          </p>
          <button
            onClick={() => (window.location.href = '/design/rm-creation')}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Requisition</span>
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredDrafts.map((group) => {
            const hasRejectedSc = group.scs.some((s) => s.status === 'REJECTED');

            return (
              <div
                key={group.poId}
                className={`bg-white border rounded-xl shadow-xs overflow-hidden transition-all ${
                  hasRejectedSc ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                }`}
              >
                <div className="px-6 py-4 bg-slate-50/80 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">PO / Reference:</span>
                      <h3 className="text-base font-bold text-slate-900">{group.poNumber}</h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Updated {new Date(group.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right mr-2 text-xs">
                      <div className="font-bold text-slate-900">{group.scs.length} Style Code(s)</div>
                      <div className="text-slate-500">
                        {group.draftCount} Draft • {group.submittedCount} Under Review
                        {(group.rejectedCount ?? 0) > 0 && (
                          <span className="text-red-600 font-bold"> • {group.rejectedCount} Rejected</span>
                        )}
                      </div>
                    </div>

                    {hasRejectedSc ? (
                      <button
                        onClick={() => handleEdit(group.poId)}
                        className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Revise & Resubmit</span>
                      </button>
                    ) : group.draftCount > 0 ? (
                      <button
                        onClick={() => handleEdit(group.poId)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-500" />
                        <span>Resume Draft</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEdit(group.poId)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-xs font-semibold shadow-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View Details</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {group.scs.map((sc) => (
                    <div
                      key={sc.scId}
                      className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-slate-900">{sc.scNumber}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-600 font-medium">Mfg: {sc.productName}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-500">{sc.itemCount} RM item(s)</span>
                        </div>

                        {/* Stores Rejection Remarks Alert Box */}
                        {sc.status === 'REJECTED' && sc.remarks && (
                          <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
                            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Stores Rejection Reason: </span>
                              <span>{sc.remarks.replace(/^\[Submit:[^\]]*\]\s*/, '')}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-3 self-end md:self-center">
                        {renderStatusBadge(sc.status)}
                        <button
                          onClick={() =>
                            setInspectSc({
                              poNumber: group.poNumber,
                              scNumber: sc.scNumber,
                              productName: sc.productName,
                              status: sc.status,
                              remarks: sc.remarks,
                              items: sc.items || [],
                            })
                          }
                          className="px-2.5 py-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                        >
                          Inspect Items
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspection Modal */}
      {inspectSc && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Requisition Items: {inspectSc.scNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  PO: {inspectSc.poNumber} • Component: {inspectSc.productName}
                </p>
              </div>
              <button
                onClick={() => setInspectSc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {inspectSc.status === 'REJECTED' && inspectSc.remarks && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  <span className="font-bold">Rejection Note: </span>
                  <span>{inspectSc.remarks}</span>
                </div>
              )}

              {inspectSc.items.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No detailed item breakdown recorded for this card.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Material</th>
                        <th className="p-3">Spec / Grade</th>
                        <th className="p-3">Dimensions / Size</th>
                        <th className="p-3 text-right">Required Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {inspectSc.items.map((item, i) => (
                        <tr key={item.id || i} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-900">{item.material || 'RM Material'}</td>
                          <td className="p-3 text-slate-700">{item.grade || 'Standard'}</td>
                          <td className="p-3 text-slate-500">{item.size || 'N/A'}</td>
                          <td className="p-3 text-right font-bold text-indigo-600 tabular-nums">
                            {item.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setInspectSc(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
