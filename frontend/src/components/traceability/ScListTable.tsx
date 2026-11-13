import { useState, useMemo, Fragment } from 'react';
import { Search, X, ShieldCheck, ArrowRight, Layers, CheckCircle2, Clock, FileText, ChevronDown, ChevronRight, Box, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { StatusBadge } from '../ui/StatusBadge';
import type { SC } from '../../services/workflowService';
import { scApi } from '../../services/api';
import { getCanonicalStage } from '../../utils/canonicalStages';

interface ScListTableProps {
  scs: SC[];
  isLoading: boolean;
  onSelectSc: (scId: string) => void;
  selectedScId?: string | null;
}

export function ScListTable({ scs, isLoading, onSelectSc, selectedScId }: ScListTableProps) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedScIds, setExpandedScIds] = useState<Set<string>>(new Set());

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    id: string;
    scNumber: string;
    productName: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setIsDeleting(true);
    try {
      await scApi.delete(deleteModal.id);
      toast.success(`Sales Component ${deleteModal.scNumber} deleted successfully.`);
      setDeleteModal(null);
      await queryClient.invalidateQueries({ queryKey: ['sc-list'] });
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete Sales Component.');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedScIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // KPI Metrics Calculation
  const totalScCount = scs.length;
  const inProductionCount = useMemo(
    () => scs.filter((s) => ['Production Received', 'Stores Issued', 'Stores Issued Partially'].includes(getCanonicalStage(s))).length,
    [scs]
  );
  const completedCount = useMemo(
    () => scs.filter((s) => ['COMPLETED', 'CLOSED'].includes(s.status) || getCanonicalStage(s) === 'Production Received').length,
    [scs]
  );
  const draftCount = useMemo(
    () => scs.filter((s) => ['Draft', 'Stores Pending'].includes(getCanonicalStage(s))).length,
    [scs]
  );

  // Filtered SC List
  const filteredScs = useMemo(() => {
    return scs.filter((sc) => {
      const canonical = getCanonicalStage(sc);

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'IN_PRODUCTION' && !['Production Received', 'Stores Issued', 'Stores Issued Partially'].includes(canonical)) {
          return false;
        }
        if (statusFilter === 'COMPLETED' && !['COMPLETED', 'CLOSED'].includes(sc.status) && canonical !== 'Production Received') {
          return false;
        }
        if (statusFilter === 'DRAFT' && !['Draft', 'Stores Pending'].includes(canonical)) {
          return false;
        }
      }

      // Search term filter
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      const matchScNumber = sc.scNumber?.toLowerCase().includes(term);
      const matchProduct = sc.productName?.toLowerCase().includes(term);
      const matchPo = (sc.purchaseOrder as any)?.poNumber?.toLowerCase().includes(term);
      const matchCustomer = (sc.purchaseOrder as any)?.customer?.name?.toLowerCase().includes(term);
      const matchDrawing = sc.drawingNumber?.toLowerCase().includes(term);
      const matchStatus = sc.status?.toLowerCase().includes(term) || canonical.toLowerCase().includes(term);

      return matchScNumber || matchProduct || matchPo || matchCustomer || matchDrawing || matchStatus;
    });
  }, [scs, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* 1. Header KPI Cards - Showing Total SC Numbers and Status Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Total SCs Card */}
        <div className="bg-white border-2 border-blue-200/80 rounded-2xl p-4 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total SC Numbers</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 tabular-nums">
              {isLoading ? '...' : totalScCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Sales Components</span>
          </div>
        </div>

        {/* In Production / WIP */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">In Production / WIP</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-700 tabular-nums">
              {isLoading ? '...' : inProductionCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Active SCs</span>
          </div>
        </div>

        {/* Completed / Closed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed & Closed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-700 tabular-nums">
              {isLoading ? '...' : completedCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Fulfilled</span>
          </div>
        </div>

        {/* Draft / Stores Pending */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Draft / Pending</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-700 tabular-nums">
              {isLoading ? '...' : draftCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">Pre-Release</span>
          </div>
        </div>
      </div>

      {/* 2. Search Bar and Status Quick Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Search Input Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by SC number, component name, PO number, drawing #..."
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

        {/* Quick Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({totalScCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('IN_PRODUCTION')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'IN_PRODUCTION'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            In Production ({inProductionCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Completed ({completedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DRAFT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              statusFilter === 'DRAFT'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Draft ({draftCount})
          </button>
        </div>
      </div>

      {/* 3. Individual SC Items Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
                <th className="py-3.5 px-4 font-bold">SC Number</th>
                <th className="py-3.5 px-4 font-bold">Component / Assembly Name</th>
                <th className="py-3.5 px-4 font-bold">Purchase Order</th>
                <th className="py-3.5 px-4 font-bold text-right">Target Qty</th>
                <th className="py-3.5 px-4 font-bold text-center">RM Specs</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Created Date</th>
                <th className="py-3.5 px-4 font-bold text-right">Traceability Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading SC registry records...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredScs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 text-sm">No Sales Order Components found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm ? `No records match "${searchTerm}".` : 'No Sales Components registered in the system.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredScs.map((sc) => {
                  const isSelected = selectedScId === sc.id || selectedScId === sc.scNumber;
                  const poNum = (sc.purchaseOrder as any)?.poNumber;
                  const customerName = (sc.purchaseOrder as any)?.customer?.name;
                  const rawItems: any[] = sc.rmRequest?.items || sc.rmItems || [];
                  const rmItemsCount = rawItems.length;
                  const isExpanded = expandedScIds.has(sc.id);
                  const totalItemsQty = rawItems.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0);
                  const formattedDate = sc.createdAt
                    ? new Date(sc.createdAt).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : '—';

                  return (
                    <Fragment key={sc.id}>
                      <tr
                        onClick={() => onSelectSc(sc.id || sc.scNumber)}
                        className={`cursor-pointer transition-colors group ${
                          isSelected
                            ? 'bg-blue-50/80 hover:bg-blue-50'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* SC Number */}
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 group-hover:border-blue-400 transition-colors">
                            <Layers className="w-3 h-3 text-blue-500" />
                            {sc.scNumber}
                          </span>
                        </td>

                        {/* Component Name */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                            {sc.productName}
                          </div>
                          {sc.drawingNumber && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              DWG: {sc.drawingNumber}
                            </div>
                          )}
                        </td>

                        {/* Purchase Order */}
                        <td className="py-3 px-4">
                          {poNum ? (
                            <div>
                              <span className="font-mono font-bold text-slate-700">{poNum}</span>
                              {customerName && (
                                <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                  {customerName}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No PO Linked</span>
                          )}
                        </td>

                        {/* Target Qty */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {Number(sc.targetQuantity || 1).toLocaleString()} NOS
                        </td>

                        {/* RM Specs */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(sc.id, e)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all border cursor-pointer ${
                              isExpanded
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border-slate-200'
                            }`}
                            title="Click to view child items and quantities"
                          >
                            <Layers className="w-3 h-3" />
                            <span>{rmItemsCount} {rmItemsCount === 1 ? 'part' : 'parts'}</span>
                            {rmItemsCount > 0 && (
                              isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              )
                            )}
                          </button>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <StatusBadge status={getCanonicalStage(sc)} />
                        </td>

                        {/* Created Date */}
                        <td className="py-3 px-4 text-slate-500 tabular-nums">
                          {formattedDate}
                        </td>

                        {/* Traceability Action */}
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectSc(sc.id || sc.scNumber);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white transition-all shadow-2xs cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>Trace Lifecycle</span>
                              <ArrowRight className="w-3 h-3 ml-0.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteModal({
                                  id: sc.id,
                                  scNumber: sc.scNumber,
                                  productName: sc.productName,
                                });
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title={`Delete SC ${sc.scNumber}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row: Child Item Matrix */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={8} className="p-3 pl-8 pr-6">
                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Box className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                                    Child Item Breakdown for SC #{sc.scNumber}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">
                                    ({rawItems.length} {rawItems.length === 1 ? 'component' : 'components'})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                    1 Set = 2 Numbers (NOS)
                                  </span>
                                  <span className="text-xs font-mono font-extrabold text-slate-900 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-md">
                                    Total: {totalItemsQty.toLocaleString()} NOS
                                  </span>
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left">
                                  <thead className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 border-b border-slate-100">
                                    <tr>
                                      <th className="py-2 px-3 text-center w-8">#</th>
                                      <th className="py-2 px-3">Child Component / Material Name</th>
                                      <th className="py-2 px-3">Part No.</th>
                                      <th className="py-2 px-3">Material & Grade</th>
                                      <th className="py-2 px-3">Size / Spec</th>
                                      <th className="py-2 px-3 text-right">Quantity (NOS)</th>
                                      <th className="py-2 px-3">Remarks</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {rawItems.map((it: any, i: number) => {
                                      const itName = it.partName || it.material || 'Child Component';
                                      const textLower = (itName + ' ' + (it.remarks || '') + ' ' + (it.weightUnit || '')).toLowerCase();
                                      const isSet =
                                        textLower.includes('set') ||
                                        textLower.includes('disc') ||
                                        textLower.includes('pair') ||
                                        textLower.includes('spg') ||
                                        textLower.includes('srg') ||
                                        textLower.startsWith('sp ') ||
                                        textLower.startsWith('sr ');
                                      return (
                                        <tr key={it.id || i} className="hover:bg-slate-50/50">
                                          <td className="py-2 px-3 text-center font-mono text-slate-400">{i + 1}</td>
                                          <td className="py-2 px-3 font-semibold text-slate-900">
                                            {itName}
                                            {isSet && (
                                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                                Set Pair
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-mono font-medium text-slate-600">
                                            {it.partNumber || sc.scNumber}
                                          </td>
                                          <td className="py-2 px-3 text-slate-600">
                                            {it.material || 'Material'} {it.grade ? `(${it.grade})` : ''}
                                          </td>
                                          <td className="py-2 px-3 font-mono text-slate-500">
                                            {it.size || 'Standard'}
                                          </td>
                                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                            {Number(it.quantity || 0).toLocaleString()} {it.weightUnit || 'NOS'}
                                          </td>
                                          <td className="py-2 px-3 text-slate-400">
                                            {it.remarks || (isSet ? '1 set = 2 numbers' : '—')}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {rawItems.length === 0 && (
                                      <tr>
                                        <td colSpan={7} className="py-3 text-center text-slate-400 italic">
                                          No child items registered under this SC.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong>{filteredScs.length}</strong> of <strong>{totalScCount}</strong> Sales Components
          </span>
          <span className="text-slate-400">Click any row to open the complete Zero-Loss Lifecycle Audit Trail</span>
        </div>
      </div>

      {/* Delete SC Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Sales Component</h3>
                <p className="text-xs text-slate-500 font-mono">SC: {deleteModal.scNumber}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete Sales Component <strong className="text-slate-900 font-bold">{deleteModal.scNumber}</strong> ({deleteModal.productName})?
              This will remove this component and its unissued requisition data. This action cannot be undone.
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
