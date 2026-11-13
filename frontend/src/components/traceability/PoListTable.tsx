import { useState, useMemo } from 'react';
import { Search, X, Network, ArrowRight, FileBadge, Calendar, Building, Layers, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { StatusBadge } from '../ui/StatusBadge';
import { poApi } from '../../services/api';
import { getGeneralizedPoStage } from '../../utils/canonicalStages';

interface PoListTableProps {
  pos: any[];
  isLoading: boolean;
  onSelectPo: (poId: string) => void;
  selectedPoId?: string | null;
}

export function PoListTable({ pos, isLoading, onSelectPo, selectedPoId }: PoListTableProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    id: string;
    poNumber: string;
    scCount: number;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await poApi.delete(deleteModal.id);
      toast.success(`Purchase Order ${deleteModal.poNumber} deleted successfully.`);
      setDeleteModal(null);
      await queryClient.invalidateQueries({ queryKey: ['po-list'] });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete Purchase Order.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Total PO metrics
  const totalPoCount = pos.length;
  const totalAssociatedScs = useMemo(() => {
    return pos.reduce((sum, po) => sum + (po.salesOrderComponents?.length || 0), 0);
  }, [pos]);

  const uniqueCustomersCount = useMemo(() => {
    const custSet = new Set(pos.map((p) => p.customer?.id || p.customerId).filter(Boolean));
    return custSet.size;
  }, [pos]);

  // Filtered PO list
  const filteredPos = useMemo(() => {
    if (!searchTerm.trim()) return pos;
    const term = searchTerm.toLowerCase().trim();

    return pos.filter((po) => {
      const matchPo = po.poNumber?.toLowerCase().includes(term);
      const matchCustomer = po.customer?.name?.toLowerCase().includes(term) || po.customer?.code?.toLowerCase().includes(term);
      const generalizedStage = getGeneralizedPoStage(po.salesOrderComponents || []);
      const matchStatus = po.status?.toLowerCase().includes(term) || generalizedStage.toLowerCase().includes(term);
      const matchScs = po.salesOrderComponents?.some((sc: any) =>
        sc.scNumber?.toLowerCase().includes(term) || sc.productName?.toLowerCase().includes(term)
      );

      return matchPo || matchCustomer || matchStatus || matchScs;
    });
  }, [pos, searchTerm]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPI Cards - Showing Total PO Numbers and Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* Total PO Numbers Card */}
        <div className="bg-white border-2 border-indigo-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total PO Numbers</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileBadge className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {isLoading ? '...' : totalPoCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Purchase Orders</span>
          </div>
        </div>

        {/* Associated SC Components */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Associated SC Components</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-700 tabular-nums">
              {isLoading ? '...' : totalAssociatedScs}
            </span>
            <span className="text-xs text-slate-500 font-medium">Linked Components</span>
          </div>
        </div>

        {/* Unique Customers */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Customers</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Building className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700 tabular-nums">
              {isLoading ? '...' : uniqueCustomersCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Enterprise Clients</span>
          </div>
        </div>
      </div>

      {/* 2. Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by PO number (e.g. PO-2026-9901), customer name, or associated SC..."
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Individual PO Items Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                <th className="py-3.5 px-4 font-bold">PO Number</th>
                <th className="py-3.5 px-4 font-bold">Customer</th>
                <th className="py-3.5 px-4 font-bold">Associated SC Components</th>
                <th className="py-3.5 px-4 font-bold">PO Date</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Macro-Traceability Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading Purchase Order registry records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No Purchase Orders found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? `No records match "${searchTerm}".` : 'No Purchase Orders registered in the system.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPos.map((po) => {
                  const isSelected = selectedPoId === po.id || selectedPoId === po.poNumber;
                  const scList: any[] = po.salesOrderComponents || [];
                  const rmCreatedDate =
                    po.createdAt ||
                    po.referenceDate ||
                    (scList.length > 0 && scList[0]?.createdAt) ||
                    po.poDate;
                  const formattedPoDate = rmCreatedDate
                    ? new Date(rmCreatedDate).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';

                  return (
                    <tr
                      key={po.id}
                      onClick={() => onSelectPo(po.id || po.poNumber)}
                      className={`cursor-pointer transition-colors group ${
                        isSelected
                          ? 'bg-indigo-50/80 hover:bg-indigo-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* PO Number */}
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 group-hover:border-indigo-400 transition-colors">
                          <FileBadge className="w-3 h-3 text-indigo-500" />
                          {po.poNumber}
                        </span>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4">
                        {po.customer?.name ? (
                          <>
                            <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                              {po.customer.name}
                            </div>
                            {po.customer.code && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                Code: {po.customer.code}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* Associated SC Components */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 tabular-nums">
                            {scList.length} {scList.length === 1 ? 'Component' : 'Components'}
                          </span>
                          {scList.slice(0, 2).map((sc: any) => (
                            <span
                              key={sc.id || sc.scNumber}
                              className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {sc.scNumber}
                            </span>
                          ))}
                          {scList.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              +{scList.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* PO Date (when RM was created) */}
                      <td className="py-3 px-4 text-slate-600 tabular-nums">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="font-medium">{formattedPoDate}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <StatusBadge status={getGeneralizedPoStage(scList)} />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPo(po.id || po.poNumber);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white transition-all shadow-2xs cursor-pointer"
                          >
                            <Network className="w-3.5 h-3.5" />
                            <span>View PO Traceability</span>
                            <ArrowRight className="w-3 h-3 ml-0.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteModal({
                                id: po.id,
                                poNumber: po.poNumber,
                                scCount: scList.length,
                              });
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title={`Delete PO ${po.poNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredPos.length}</strong> of <strong>{totalPoCount}</strong> Purchase Orders
          </span>
          <span className="text-slate-400">Click any row to open the complete PO Macro-Traceability Dashboard</span>
        </div>
      </div>

      {/* Delete PO Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Purchase Order</h3>
                <p className="text-xs text-slate-500 font-mono">PO: {deleteModal.poNumber}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete Purchase Order <strong className="text-slate-900 font-bold">{deleteModal.poNumber}</strong>
              {deleteModal.scCount > 0 ? ` and its ${deleteModal.scCount} associated component(s)` : ''}?
              This will remove this Purchase Order and its unissued components. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
