import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Lock, X } from 'lucide-react';

interface GovernanceConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  scId?: string;
  ginIndent?: string;
}

export function GovernanceConfirmationModal({
  isOpen,
  onClose,
  onSubmit,
  scId = 'SC-001',
  ginIndent = 'GIN-REQ-2026-0881',
}: GovernanceConfirmationModalProps) {
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (isConfirmed) {
      setIsLoading(true);
      try {
        await onSubmit();
        setIsConfirmed(false);
        onClose();
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
      <div 
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-xl flex flex-col shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.04)] animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center border border-red-200">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Confirm Material Action?</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                {scId}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium leading-relaxed">
              <span className="font-bold">Critical Lock Warning:</span> Once submitted, profile shapes, metallurgical alloy grades, dimensions, and quantities become permanently immutable in the traceability ledger.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">System Actions:</h3>
            <ul className="space-y-3">
              {[
                { text: 'Records the material issue in the traceability ledger' },
                { text: 'Deducts the specified quantities from available stock' },
                { text: 'Associates the issue with the selected component' },
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <span>
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-start gap-3 mt-2">
            <input
              type="checkbox"
              id="confirm-checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-1 w-4 h-4 text-primary bg-white border-slate-300 rounded cursor-pointer focus:ring-primary focus:ring-2 focus:ring-offset-1"
            />
            <label htmlFor="confirm-checkbox" className="text-sm font-medium text-slate-700 cursor-pointer select-none leading-relaxed">
              I confirm that all dimensions, cut allowances, and metallurgical specs conform strictly to the drawing.
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-900 text-sm font-semibold rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
          >
            Cancel / Return to Editing
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary ${
              isConfirmed && !isLoading
                ? 'bg-primary text-white hover:bg-blue-700 shadow-sm' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            }`}
          >
            {isLoading ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {isLoading ? 'Processing...' : 'Confirm & Permanently Lock'}
          </button>
        </div>
      </div>
    </div>
  );
}
