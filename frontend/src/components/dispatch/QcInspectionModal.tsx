import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { extractErrorMessage } from '../../utils/extractErrorMessage';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  PackageCheck,
  ShieldAlert,
  ArrowRight,
  Warehouse,
} from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';
import type { QcInspectDcDto } from '../../types/dc-return.dto';

interface QcInspectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  dc: DeliveryChallanDto | null;
  onSuccess?: () => void;
}

interface ItemQcState {
  itemId: string;
  passedQty: number;
  rejectedQty: number;
  actualStoreInwardQty: number;
  targetBinId: string;
  qcRemarks: string;
}

export function QcInspectionModal({ isOpen, onClose, dc, onSuccess }: QcInspectionModalProps) {
  const queryClient = useQueryClient();
  const [qcItems, setQcItems] = useState<Record<string, ItemQcState>>({});

  const { data: allBins = [] } = useQuery({
    queryKey: ['all-bins-master'],
    queryFn: async () => {
      const res = await masterDataService.getBins({ pageSize: 1000, isActive: true });
      return res.data || [];
    },
    staleTime: 60000,
  });

  const isType1 = dc?.type === 'PRODUCTION_PROCESS_OUTWARD';

  // Initialize line items state when modal opens
  useEffect(() => {
    if (!dc || !dc.items) return;
    const initial: Record<string, ItemQcState> = {};
    dc.items.forEach((item) => {
      const pendingQc = Number(item.qcPendingQty || 0);
      initial[item.id] = {
        itemId: item.id,
        passedQty: pendingQc, // Default all pending QC to passed, user can split
        rejectedQty: 0,
        actualStoreInwardQty: Number(item.actualReceivedQty || item.expectedOutputQuantity || pendingQc),
        targetBinId: item.returnTargetBinId || item.outputBinId || item.binId || '',
        qcRemarks: '',
      };
    });
    setQcItems(initial);
  }, [dc]);

  const inspectMutation = useMutation({
    mutationFn: (payload: QcInspectDcDto) => {
      if (!dc) throw new Error('No DC selected');
      return deliveryChallanApi.qcInspect(dc.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      queryClient.invalidateQueries({ queryKey: ['rework-items'] });
      toast.success('Quality check inspection verified & split successfully!');
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      toast.error(extractErrorMessage(err, 'Failed to submit QC inspection'));
    },
  });

  // Calculate live totals across all inspected items
  const summary = useMemo(() => {
    if (!dc || !dc.items)
      return { totalPending: 0, totalPassed: 0, totalRejected: 0, totalStillAtVendor: 0, isValid: true };
    let totalPending = 0;
    let totalPassed = 0;
    let totalRejected = 0;
    let totalStillAtVendor = 0;
    let isValid = true;

    for (const item of dc.items) {
      const target = !isType1
        ? Number(item.expectedReturnQty ?? item.expectedOutputQuantity ?? item.quantityDispatched ?? 0)
        : Number(item.quantityDispatched || 0);
      const pendingQc = Number(item.qcPendingQty || 0);
      const passedSoFar = Number(item.qcPassedQty || 0);
      const rejectedSoFar = Number(item.qcRejectedQty || 0);
      const stillAtVendor = Math.max(0, target - (pendingQc + passedSoFar + rejectedSoFar));
      totalPending += pendingQc;
      totalStillAtVendor += stillAtVendor;

      const state = qcItems[item.id];
      if (state) {
        const p = Number(state.passedQty || 0);
        const r = Number(state.rejectedQty || 0);
        totalPassed += p;
        totalRejected += r;
        if (p < 0 || r < 0 || p + r > pendingQc + 0.0001 || (pendingQc > 0 && p + r <= 0)) {
          isValid = false;
        }
      }
    }

    return { totalPending, totalPassed, totalRejected, totalStillAtVendor, isValid };
  }, [dc, qcItems]);

  if (!isOpen || !dc) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.isValid) {
      toast.error('Please resolve validation errors before submitting.');
      return;
    }

    const itemsToSubmit = Object.values(qcItems).filter((state) => {
      const item = dc.items.find((i) => i.id === state.itemId);
      return Number(item?.qcPendingQty || 0) > 0;
    });

    if (itemsToSubmit.length === 0) {
      toast.error('No items currently pending QC inspection.');
      return;
    }

    const payload: QcInspectDcDto = {
      inspectionDate: new Date().toISOString(),
      items: itemsToSubmit.map((state) => ({
        itemId: state.itemId,
        passedQty: Number(state.passedQty || 0),
        rejectedQty: Number(state.rejectedQty || 0),
        ...(!isType1 && {
          actualStoreInwardQty: Number(state.actualStoreInwardQty || state.passedQty),
          targetBinId: state.targetBinId || undefined,
        }),
        qcRemarks: state.qcRemarks || undefined,
      })),
    };

    inspectMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Quality Check (QC) Gate — {dc.challanNumber || dc.dcNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {isType1 ? 'Type 1 (Process)' : 'Type 2 (Stock Conversion)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Vendor: <span className="font-semibold text-slate-700">{dc.vendor?.name || dc.vendorName || 'Vendor'}</span> | Dispatched: {dc.dispatchDate ? new Date(dc.dispatchDate).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance Banner */}
        <div className={`px-6 py-3 border-b text-xs flex items-start gap-2.5 ${
          isType1 ? 'bg-purple-50/70 border-purple-200 text-purple-900' : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
        }`}>
          {isType1 ? (
            <>
              <ShieldAlert className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Type 1 Process Outward (WIP Flow):</span> Passing QC verifies vendor workmanship under the Sales Order Component ({dc.scCode || 'SC'}). Material remains in production WIP — zero warehouse stock-in movement will be executed.
              </div>
            </>
          ) : (
            <>
              <Warehouse className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Type 2 General Inventory Return (Stock Movement):</span> Passing QC marks converted material as usable. The system will atomically credit the <span className="underline font-bold">Actual Store Inward Qty</span> directly into the selected Warehouse Bin ledger.
              </div>
            </>
          )}
        </div>

        {/* Line Items List */}
        <form id="qc-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {dc.items.map((item, idx) => {
            const pendingQc = Number(item.qcPendingQty || 0);
            const target = !isType1
              ? Number(item.expectedReturnQty ?? item.expectedOutputQuantity ?? item.quantityDispatched ?? 0)
              : Number(item.quantityDispatched || 0);
            const passedSoFar = Number(item.qcPassedQty || 0);
            const rejectedSoFar = Number(item.qcRejectedQty || 0);
            const stillAtVendor = Math.max(0, target - (pendingQc + passedSoFar + rejectedSoFar));

            const state = qcItems[item.id] || {
              passedQty: 0,
              rejectedQty: 0,
              actualStoreInwardQty: 0,
              targetBinId: '',
              qcRemarks: '',
            };

            const itemSum = Number(state.passedQty || 0) + Number(state.rejectedQty || 0);
            const isItemExceeded = itemSum > pendingQc + 0.0001;
            const isItemZero = pendingQc > 0 && itemSum <= 0;

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all space-y-4"
              >
                {/* Item Details Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm">
                        {item.product?.name || item.partName || 'Line Item Material'}
                      </h3>
                      {item.sc?.scNumber && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-medium border border-blue-200">
                          {item.sc.scNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Part #: {item.partNumber || item.product?.code || 'N/A'} | UOM: {item.uom || item.product?.uom || 'PCS'}
                    </p>
                  </div>

                  {/* Quantity Matrix Status Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200" title={isType1 ? "Original Dispatched Quantity" : "Expected Output / Return Quantity"}>
                      {isType1 ? 'Sent' : 'Expected'}: <strong className="font-mono">{target}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200" title="Previously QC Passed">
                      Passed: <strong className="font-mono">{passedSoFar}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200" title="Previously QC Rejected">
                      Rework: <strong className="font-mono">{rejectedSoFar}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200" title="Still physically with vendor">
                      At Vendor: <strong className="font-mono">{stillAtVendor}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-bold border border-blue-300" title="Current Batch Awaiting Inspector">
                      Pending QC: <strong className="font-mono">{pendingQc}</strong>
                    </span>
                  </div>
                </div>

                {pendingQc <= 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 italic text-center">
                    No units currently pending QC inspection for this item.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Dual Inputs: QC Passed (OK) vs QC Rejected (Rework) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* QC Passed Input */}
                      <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-1.5">
                        <label className="flex items-center justify-between text-xs font-semibold text-emerald-900">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            QC Passed (OK Quantity)
                          </span>
                          <span className="text-[10px] text-emerald-700 font-normal">Closes progress</span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={pendingQc}
                          value={state.passedQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setQcItems((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...state,
                                passedQty: val,
                                // Auto calculate rework if user wants quick split
                                rejectedQty: Math.max(0, pendingQc - val),
                                actualStoreInwardQty: !isType1 ? val : state.actualStoreInwardQty,
                              },
                            }));
                          }}
                          className="w-full h-10 px-3 rounded-lg bg-white border border-emerald-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 tabular-nums shadow-sm"
                        />
                      </div>

                      {/* QC Rejected Input */}
                      <div className="p-3.5 bg-amber-50/40 rounded-xl border border-amber-200 space-y-1.5">
                        <label className="flex items-center justify-between text-xs font-semibold text-amber-900">
                          <span className="flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            QC Rejected (Send to Rework)
                          </span>
                          <span className="text-[10px] text-amber-700 font-normal">Pushed to Rework Tab</span>
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          max={pendingQc}
                          value={state.rejectedQty}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setQcItems((prev) => ({
                              ...prev,
                              [item.id]: {
                                ...state,
                                rejectedQty: val,
                                passedQty: Math.max(0, pendingQc - val),
                              },
                            }));
                          }}
                          className="w-full h-10 px-3 rounded-lg bg-white border border-amber-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 tabular-nums shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Type 2 Stock Conversion Actual Inward Qty & Target Bin */}
                    {!isType1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-1">
                            Actual Store Inward Qty (Stock-In)
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={state.actualStoreInwardQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setQcItems((prev) => ({
                                ...prev,
                                [item.id]: { ...state, actualStoreInwardQty: val },
                              }));
                            }}
                            className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary tabular-nums"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Editable yield/weight (e.g. 8.500 KG vs 10.000 KG expected).
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-800 mb-1">
                            Target Warehouse Bin
                          </label>
                          <select
                            value={state.targetBinId}
                            onChange={(e) => {
                              setQcItems((prev) => ({
                                ...prev,
                                [item.id]: { ...state, targetBinId: e.target.value },
                              }));
                            }}
                            className="w-full h-9 px-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">Select Target Bin...</option>
                            {allBins.map((b: any) => (
                              <option key={b.id} value={b.id}>
                                {b.code} ({b.warehouse?.name || 'Store'} – Rack {b.rack?.name || 'Rack'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Confirmation Callout */}
                        <div className="sm:col-span-2 p-3 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2 shadow-xs">
                          <Warehouse className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold block">Type 2 Stock-In Confirmation:</span>
                            <span className="text-blue-800">
                              Upon QC Pass, exactly <strong>{state.actualStoreInwardQty || state.passedQty} {item.product?.uom || 'units'}</strong> will be atomically credited into the selected warehouse bin with an immutable ledger entry.
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Remarks input */}
                    <div>
                      <input
                        type="text"
                        placeholder="QC failure remarks or notes (e.g., surface roughness, thread tolerance)..."
                        value={state.qcRemarks}
                        onChange={(e) => {
                          setQcItems((prev) => ({
                            ...prev,
                            [item.id]: { ...state, qcRemarks: e.target.value },
                          }));
                        }}
                        className="w-full h-9 px-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {/* Real-time Item Validation Warning */}
                    {isItemExceeded && (
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Sum of Passed ({state.passedQty}) and Rejected ({state.rejectedQty}) exceeds Pending QC ({pendingQc}).
                      </p>
                    )}
                    {isItemZero && (
                      <p className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Please enter at least some quantity to pass or reject.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </form>

        {/* Live Outcome Summary Banner */}
        <div className="px-6 py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 font-medium text-slate-700">
            <span className="font-semibold text-slate-900">QC Split Outcome Preview:</span>
            <span className="font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-200">
              +{summary.totalPassed} units → Closed / Passed
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded border border-rose-200">
              +{summary.totalRejected} units → Rework Tab
            </span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
              {summary.totalStillAtVendor} units → Remain at Vendor
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="qc-form"
              disabled={!summary.isValid || inspectMutation.isPending || summary.totalPending === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-secondary transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {inspectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
              <span>{inspectMutation.isPending ? 'Verifying...' : 'Commit QC Verification & Split'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
