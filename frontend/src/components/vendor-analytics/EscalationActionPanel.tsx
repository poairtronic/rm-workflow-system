import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Mail, Phone, Loader2, ChevronDown, Lock } from 'lucide-react';
import { vendorAnalyticsApi } from '../../services/api';
import type { VendorCustodyItem } from '../../types/vendor-analytics.dto';

interface EscalationActionPanelProps {
  item: VendorCustodyItem;
  canEscalate?: boolean; // Mock RBAC flag
}

export function EscalationActionPanel({ item, canEscalate = true }: EscalationActionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const escalateMutation = useMutation({
    mutationFn: (type: 'EMAIL' | 'SMS' | 'MANUAL_CALL') => {
      return vendorAnalyticsApi.escalateDc(item.dcNumber, { type, notes: type === 'MANUAL_CALL' ? notes : undefined });
    },
    onSuccess: (_, type) => {
      toast.success(type === 'MANUAL_CALL' ? 'Call log saved' : 'Automated chaser dispatched successfully');
      setIsOpen(false);
      setNotes('');
    },
    onError: () => {
      toast.error('Failed to trigger escalation');
    }
  });

  if (!item.isOverdue) {
    return <span className="text-slate-400 text-xs">-</span>;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${isOpen ? 'bg-slate-100 text-slate-900' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}`}
      >
        Escalate
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-20 p-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Trigger Escalation</h4>
          
          {!canEscalate ? (
            <div className="flex items-start gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs text-slate-600 mb-3">
              <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>You do not have the required Managerial privileges to trigger an escalation.</span>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => escalateMutation.mutate('EMAIL')}
                disabled={escalateMutation.isPending}
                className="w-full inline-flex items-center justify-center gap-2 px-4 h-9 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50"
              >
                {escalateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Automated Chaser
              </button>

              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-medium text-slate-700 mb-1">Manual Call Log</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes from phone conversation..."
                  rows={2}
                  className="w-full p-2 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary mb-2 resize-none"
                />
                <button
                  onClick={() => escalateMutation.mutate('MANUAL_CALL')}
                  disabled={escalateMutation.isPending || !notes.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 h-9 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
                >
                  {escalateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                  Log Call & Warn Vendor
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
