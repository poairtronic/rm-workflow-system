import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Send, Loader2, RotateCcw, AlertTriangle, Building2, Calendar, FileText } from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import { vendorMasterApi } from '../../services/vendorMaster.service';
import type { DcReworkItemDto } from '../../types/delivery-challan.dto';

interface CreateReworkDcModalProps {
  isOpen: boolean;
  onClose: () => void;
  reworkItem: DcReworkItemDto | null;
  onSuccess?: () => void;
}

export function CreateReworkDcModal({ isOpen, onClose, reworkItem, onSuccess }: CreateReworkDcModalProps) {
  const queryClient = useQueryClient();
  const [useOriginalVendor, setUseOriginalVendor] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [targetReturnDate, setTargetReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  // Prefill and synchronize form state whenever modal opens or reworkItem changes
  useEffect(() => {
    if (isOpen && reworkItem) {
      setUseOriginalVendor(true);
      setSelectedVendorId('');
      const d = new Date();
      d.setDate(d.getDate() + 5);
      setTargetReturnDate(d.toISOString().split('T')[0]);
      setNotes(
        `Rework DC for defective units from ${reworkItem.sourceDcNumber}. QC Remarks: ${reworkItem.qcRemarks || 'None'}`
      );
    }
  }, [isOpen, reworkItem]);

  const { data: allVendors = [] } = useQuery({
    queryKey: ['all-vendors-master'],
    queryFn: () => vendorMasterApi.getAll({ isActive: true }),
    enabled: isOpen,
  });

  const reDispatchMutation = useMutation({
    mutationFn: (payload: { vendorId: string; targetReturnDate?: string; notes?: string }) => {
      if (!reworkItem) throw new Error('No rework item selected');
      return deliveryChallanApi.reDispatchReworkItem(reworkItem.id, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      queryClient.invalidateQueries({ queryKey: ['rework-items'] });
      toast.success(
        `Rework DC ${data?.deliveryChallan?.challanNumber || data?.deliveryChallan?.dcNumber || ''} created and dispatched!`
      );
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Failed to generate rework DC';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });

  if (!isOpen || !reworkItem) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = useOriginalVendor ? reworkItem.originalVendorId : selectedVendorId;
    if (!vendorId) {
      toast.error('Please select a destination vendor.');
      return;
    }

    reDispatchMutation.mutate({
      vendorId,
      targetReturnDate: targetReturnDate ? new Date(targetReturnDate).toISOString() : undefined,
      notes: notes || `Rework DC for defective units from ${reworkItem.sourceDcNumber}. QC Remarks: ${reworkItem.qcRemarks || 'None'}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Raise New Rework Delivery Challan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Re-dispatching {reworkItem.rejectedQty} {reworkItem.uom} under same SC # / PO #
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Locked Upstream Context Card */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Locked Upstream Traceability
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Source DC #:</span>
                <span className="font-mono font-bold text-slate-800">{reworkItem.sourceDcNumber}</span>
              </div>
              <div>
                <span className="text-slate-500 block">SC # / PO #:</span>
                <span className="font-mono font-bold text-blue-700">
                  {reworkItem.scNumber || 'N/A'} {reworkItem.poNumber ? `(${reworkItem.poNumber})` : ''}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Material / SKU:</span>
                <span className="font-semibold text-slate-800">{reworkItem.productName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Rejected Quantity:</span>
                <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block">
                  {reworkItem.rejectedQty} {reworkItem.uom}
                </span>
              </div>
            </div>

            {reworkItem.qcRemarks && (
              <div className="mt-2 pt-2 border-t border-slate-200/70 text-xs flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong className="font-semibold">QC Failure Reason:</strong> {reworkItem.qcRemarks}
                </span>
              </div>
            )}
          </div>

          {/* Vendor Assignment Option */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-800">Destination Vendor</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setUseOriginalVendor(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  useOriginalVendor
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-semibold block">Same Vendor</span>
                <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                  {reworkItem.originalVendorName}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setUseOriginalVendor(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !useOriginalVendor
                    ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-semibold block">Alternative Vendor</span>
                <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                  Assign to another vendor
                </span>
              </button>
            </div>

            {!useOriginalVendor && (
              <div className="mt-2 animate-in fade-in duration-150">
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    required={!useOriginalVendor}
                    className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  >
                    <option value="">Select Alternative Vendor...</option>
                    {(allVendors as any[]).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.code} – {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Expected SLA Date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Target Return Date (SLA)
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={targetReturnDate}
                onChange={(e) => setTargetReturnDate(e.target.value)}
                required
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm tabular-nums"
              />
            </div>
          </div>

          {/* Special Dispatch Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-800">
              Rework Instructions / Notes
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Specific instructions for rework/correction process..."
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reDispatchMutation.isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-secondary transition-all shadow-sm disabled:opacity-50"
            >
              {reDispatchMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{reDispatchMutation.isPending ? 'Generating DC...' : 'Dispatch Rework DC'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
