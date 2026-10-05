import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Lock, AlertTriangle, Loader2 } from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';

interface ChallanClosureModalProps {
  dc: DeliveryChallanDto | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChallanClosureModal({ dc, isOpen, onClose, onSuccess }: ChallanClosureModalProps) {
  const queryClient = useQueryClient();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [closureNotes, setClosureNotes] = useState('');

  const closeDcMutation = useMutation({
    mutationFn: () => {
      if (!dc) throw new Error('No DC selected');
      return deliveryChallanApi.close(dc.id, { closureNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success(`Delivery Challan ${dc?.dcNumber} permanently closed.`);
      onSuccess();
    },
    onError: (error: any) => {
      const status = error.response?.status;
      if (status === 403) {
        toast.error('Unauthorized closure attempt', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      } else {
        toast.error('Failed to close Delivery Challan');
      }
    }
  });

  if (!isOpen || !dc) return null;

  const handleClose = () => {
    setIsConfirmed(false);
    setClosureNotes('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-700" />
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              Administrative Closure
            </h2>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-amber-50 border-b border-amber-100 p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Immutable Ledger Action</p>
            <p className="text-xs text-amber-700 mt-0.5">Closing this challan is a permanent action. All variances will be locked, and no further returns or scrap allocations can be made against DC #{dc.dcNumber}.</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Closure Notes / Variance Justification
            </label>
            <textarea
              value={closureNotes}
              onChange={(e) => setClosureNotes(e.target.value)}
              placeholder="Enter final remarks..."
              rows={3}
              className="w-full p-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
          </div>

          <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
            <div className="flex items-center h-5">
              <input
                type="checkbox"
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                checked={isConfirmed}
                onChange={(e) => setIsConfirmed(e.target.checked)}
              />
            </div>
            <div className="text-sm">
              <span className="font-medium text-slate-900 block">I verify all material variances are accounted for.</span>
              <span className="text-slate-500 text-xs">This electronic signature executes the closure protocol.</span>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 h-10 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => closeDcMutation.mutate()}
            disabled={!isConfirmed || closeDcMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 h-10 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {closeDcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {closeDcMutation.isPending ? 'Closing...' : 'Sign & Close Challan'}
          </button>
        </div>
      </div>
    </div>
  );
}
