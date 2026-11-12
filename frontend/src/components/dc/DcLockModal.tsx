import { X, Lock, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { ProductLockConflict } from '../../types/delivery-challan.dto';

export interface DcLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  conflicts: ProductLockConflict[];
  title?: string;
}

export function DcLockModal({
  isOpen,
  onClose,
  conflicts = [],
  title = 'Delivery Challan Product Lock Enforced',
}: DcLockModalProps) {
  if (!isOpen || !conflicts || conflicts.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col my-8 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0 shadow-2xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h2>
              <p className="text-xs text-rose-800 font-medium mt-0.5">
                {conflicts.length} item{conflicts.length > 1 ? 's' : ''} locked due to pending open delivery challans
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Guidance */}
        <div className="p-5 bg-amber-50/70 border-b border-amber-200/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed space-y-1">
            <p className="font-semibold text-amber-950">
              Quantity-Based Product Lock Rule:
            </p>
            <p>
              Once a product is dispatched on a Delivery Challan, subsequent dispatches for that product cannot exceed its remaining <strong>available quantity</strong> until previously dispatched quantities are physically inwarded at the stores gate.
            </p>
          </div>
        </div>

        {/* Conflicts List */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
          {conflicts.map((conflict, index) => {
            const scPoText = conflict.scNumber
              ? `under SC ${conflict.scNumber}`
              : conflict.poNumber
              ? `on PO ${conflict.poNumber}`
              : '';

            const dcNumberText =
              conflict.blockingDcs && conflict.blockingDcs.length > 0
                ? conflict.blockingDcs.map((d) => d.dcNumber).join(', ')
                : 'Open DC';

            return (
              <div
                key={index}
                className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-3 shadow-2xs"
              >
                {/* Product Name & Scope Tags */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="text-sm font-bold text-slate-900">
                      {conflict.productLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {conflict.scNumber && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                        SC: {conflict.scNumber}
                      </span>
                    )}
                    {conflict.poNumber && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 font-mono">
                        PO: {conflict.poNumber}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {conflict.dcType === 'SPL_PROCESS' ? 'SPL / MERC' : 'Type 1 Process'}
                    </span>
                  </div>
                </div>

                {/* Primary conflict narrative requirement:
                    "{label}" under SC {scNumber} / on PO {poNumber}: {pendingQty} not yet inwarded (DC {dcNumber}); {availableQty} available to dispatch.
                */}
                <div className="p-3 bg-white rounded-lg border border-rose-200/70 text-xs font-medium text-slate-800 shadow-2xs leading-relaxed">
                  <span className="font-bold text-rose-700">"{conflict.productLabel}"</span>{' '}
                  {scPoText ? `${scPoText}: ` : ': '}
                  <span className="text-rose-950 font-bold">{conflict.pendingQty}</span> not yet inwarded{' '}
                  <span className="font-mono text-slate-700">(DC {dcNumberText})</span>;{' '}
                  <span className="text-emerald-700 font-bold">{conflict.availableQty}</span> available to dispatch.
                </div>

                {/* Quantitative Metric Breakdown */}
                <div className={`grid ${conflict.capQty != null ? 'grid-cols-4' : 'grid-cols-3'} gap-3 pt-1`}>
                  {conflict.capQty != null && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        Cap
                      </span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {conflict.capQty}
                      </span>
                    </div>
                  )}
                  <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                      Requested
                    </span>
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {conflict.requestedQty}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-rose-700 block">
                      Pending Inward
                    </span>
                    <span className="text-sm font-bold text-rose-800 tabular-nums">
                      {conflict.pendingQty}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 block">
                      Available Now
                    </span>
                    <span className="text-sm font-bold text-emerald-800 tabular-nums">
                      {conflict.availableQty}
                    </span>
                  </div>
                </div>

                {/* Blocking Delivery Challans Breakdown */}
                {conflict.blockingDcs && conflict.blockingDcs.length > 0 && (
                  <div className="pt-2 text-[11px] text-slate-600 space-y-1">
                    <span className="font-semibold text-slate-700">Open Delivery Challan(s) in custody:</span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {conflict.blockingDcs.map((bDc, bIdx) => (
                        <div
                          key={bIdx}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-300 font-mono text-[11px] shadow-2xs"
                        >
                          <span className="font-bold text-blue-700">{bDc.dcNumber}</span>
                          <span className="text-slate-400">•</span>
                          <span className="text-rose-700 font-semibold">{bDc.pendingQty} pending</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <p className="text-xs text-slate-500">
            Adjust requested quantities to match available stock or inward pending DCs.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Review & Adjust Quantities
          </button>
        </div>
      </div>
    </div>
  );
}
export default DcLockModal;
