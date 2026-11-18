import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

export interface RejectItemSummary {
  id: string;
  description: string;
  requestCode?: string | null;
  requestedQty?: number;
  uom?: string;
}

interface RejectReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  items: RejectItemSummary[];
  isSubmitting?: boolean;
}

export const RejectReasonModal: React.FC<RejectReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  items,
  isSubmitting = false,
}) => {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTouched(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const trimmedReason = reason.trim();
  const isValid = trimmedReason.length >= 5;
  const showValidation = touched && !isValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || isSubmitting) return;
    await onConfirm(trimmedReason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#111422] rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 id="reject-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Reject Consumable Item{items.length > 1 ? 's' : ''} ({items.length})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            You are rejecting <span className="font-bold text-slate-900 dark:text-white">{items.length}</span> line
            item{items.length > 1 ? 's' : ''}. Rejected lines are archived and cannot be issued or purchased.
            Please provide a clear reason for the audit trail.
          </p>

          {/* Selected items list */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-3 max-h-36 overflow-y-auto space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate pr-2">
                  {item.description}
                  {item.requestCode && (
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">({item.requestCode})</span>
                  )}
                </span>
                <span className="text-slate-500 dark:text-slate-400 shrink-0 font-mono text-[11px]">
                  {item.requestedQty != null ? `${item.requestedQty} ${item.uom || 'NOS'}` : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Rejection Reason Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <label htmlFor="rejection-reason">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <span className={`text-[11px] ${trimmedReason.length < 5 ? 'text-amber-500' : 'text-emerald-500 font-medium'}`}>
                {trimmedReason.length} / 5 min chars
              </span>
            </div>
            <textarea
              id="rejection-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Enter rejection reason (e.g., Sufficient existing stock available in Tool Room B)..."
              disabled={isSubmitting}
              className={`w-full px-3 py-2 text-xs rounded-lg border bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 transition-all ${
                showValidation
                  ? 'border-rose-400 focus:ring-rose-400/30'
                  : 'border-slate-300 dark:border-slate-700 focus:ring-indigo-500/30 focus:border-indigo-500'
              }`}
            />
            {showValidation && (
              <p className="text-[11px] font-medium text-rose-500">
                Rejection reason must be at least 5 characters long.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 dark:disabled:bg-rose-800/40 rounded-lg shadow-sm transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <span>Confirm Rejection</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
