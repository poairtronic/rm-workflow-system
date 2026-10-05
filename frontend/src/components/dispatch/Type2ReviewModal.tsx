import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { X, Send, Loader2 } from 'lucide-react';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';

interface Type2ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function Type2ReviewModal({ isOpen, onClose, onSubmit, isSubmitting }: Type2ReviewModalProps) {
  const { watch } = useFormContext<CreateDeliveryChallanDto>();
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!isOpen) return null;

  const destinationEntity = watch('destinationEntity');
  const purpose = watch('purpose');
  const items = watch('items') || [];
  
  const totalItemCount = items.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Review General Dispatch
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Destination Entity</p>
              <p className="text-sm font-semibold text-slate-900">{destinationEntity || 'Not specified'}</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Line Items</p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">{totalItemCount}</p>
            </div>
            <div className="col-span-2 p-4 bg-slate-50 border border-slate-100 rounded-lg">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Purpose / Justification</p>
              <p className="text-sm text-slate-800">{purpose || 'No justification provided'}</p>
            </div>
          </div>

          {/* Condensed Table */}
          <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Payload Summary</h3>
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2">Bin</th>
                  <th className="px-4 py-2 text-right">Quantity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 font-medium text-slate-900">{item.materialCode}</td>
                    <td className="px-4 py-2 text-slate-600">{item.sourceBinId}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">{item.quantity} {item.uom}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Authorization Checkbox */}
          <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg cursor-pointer">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
              />
            </div>
            <div className="text-sm">
              <span className="font-medium text-blue-900 block">I confirm this general dispatch is authorized.</span>
              <span className="text-blue-700 text-xs">This action will permanently deduct stock from the selected bins and generate an immutable ledger entry.</span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!isConfirmed || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? 'Generating...' : 'Generate DC'}
          </button>
        </div>
      </div>
    </div>
  );
}
