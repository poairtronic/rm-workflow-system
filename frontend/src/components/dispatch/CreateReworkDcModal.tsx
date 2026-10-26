import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  X,
  Send,
  Loader2,
  RotateCcw,
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
  Printer,
  CheckCircle2,
  Info,
} from 'lucide-react';
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
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [dispatchedDc, setDispatchedDc] = useState<any | null>(null);

  // Today's formatted date string
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

  // Prefill and synchronize form state whenever modal opens or reworkItem changes
  useEffect(() => {
    if (isOpen && reworkItem) {
      setUseOriginalVendor(true);
      setSelectedVendorId('');
      setDispatchedDc(null);

      const d = new Date();
      d.setDate(d.getDate() + 5);
      setTargetReturnDate(d.toISOString().split('T')[0]);

      const defaultNote = `Rework DC for defective units from ${reworkItem.sourceDcNumber}. QC Remarks: ${reworkItem.qcRemarks || 'None'}`;
      setNotes(defaultNote);
      setDescription(`Rework re-dispatch: ${reworkItem.productName} (${reworkItem.rejectedQty} ${reworkItem.uom})`);
      setRemarks(reworkItem.qcRemarks ? `QC Defect: ${reworkItem.qcRemarks}` : 'Rework and rectification required');
    }
  }, [isOpen, reworkItem]);

  const { data: allVendors = [] } = useQuery({
    queryKey: ['all-vendors-master'],
    queryFn: () => vendorMasterApi.getAll({ isActive: true }),
    enabled: isOpen,
  });

  const reDispatchMutation = useMutation({
    mutationFn: (payload: {
      vendorId: string;
      targetReturnDate?: string;
      notes?: string;
      description?: string;
      remarks?: string;
    }) => {
      if (!reworkItem) throw new Error('No rework item selected');
      return deliveryChallanApi.reDispatchReworkItem(reworkItem.id, payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      queryClient.invalidateQueries({ queryKey: ['rework-items'] });

      const dc = data?.deliveryChallan;
      const challanNumber = dc?.challanNumber || dc?.dcNumber || reworkItem?.sourceDcNumber || '';
      toast.success(`Rework DC ${challanNumber} dispatched!`);

      setDispatchedDc(dc);

      // Open print preview immediately in a new tab
      if (dc?.id) {
        const rwId = data?.reworkItem?.id || reworkItem?.id;
        const printUrl = rwId
          ? `/dispatch/delivery-challan/${dc.id}/print?reworkId=${rwId}`
          : `/dispatch/delivery-challan/${dc.id}/print`;
        window.open(printUrl, '_blank');
      }

      if (onSuccess) onSuccess();
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

    if (!useOriginalVendor) {
      if (!description.trim()) {
        toast.error('Please enter the Item Description for the new vendor.');
        return;
      }
      if (!remarks.trim()) {
        toast.error('Please enter the Remarks for the new DC.');
        return;
      }
    }

    reDispatchMutation.mutate({
      vendorId,
      targetReturnDate: targetReturnDate ? new Date(targetReturnDate).toISOString() : undefined,
      notes: useOriginalVendor ? notes : remarks,
      description: !useOriginalVendor ? description.trim() : undefined,
      remarks: !useOriginalVendor ? remarks.trim() : notes.trim(),
    });
  };

  const selectedVendorObj = (allVendors as any[]).find((v) => v.id === selectedVendorId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Raise Rework Delivery Challan
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Re-dispatching {reworkItem.rejectedQty} {reworkItem.uom} • {reworkItem.productName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Confirmation Screen or Input Form */}
        {dispatchedDc ? (
          /* Post-Dispatch Print Preview Confirmation Screen */
          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-950">
                  Rework Delivery Challan Dispatched!
                </h3>
                <p className="text-xs text-emerald-700 mt-1">
                  {useOriginalVendor
                    ? `Dispatched under source DC ${dispatchedDc.challanNumber || reworkItem.sourceDcNumber} with current date.`
                    : `New Delivery Challan ${dispatchedDc.challanNumber} generated with current date.`}
                </p>
              </div>
            </div>

            {/* DC Details Card */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">DC Number:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {dispatchedDc.challanNumber || reworkItem.sourceDcNumber}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dispatch Date:</span>
                  <span className="font-bold text-slate-900">{todayFormatted}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Destination Vendor:</span>
                  <span className="font-semibold text-slate-900">
                    {useOriginalVendor
                      ? reworkItem.originalVendorName
                      : selectedVendorObj?.name || 'Assigned Vendor'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Challan Type:</span>
                  <span className="font-semibold text-slate-900">
                    {reworkItem.dcType === 'PRODUCTION_PROCESS_OUTWARD'
                      ? 'Type 1 (Process Outward)'
                      : 'Type 2 (Stock Conversion)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Quantity:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {reworkItem.rejectedQty} {reworkItem.uom}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">SC # / PO #:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {reworkItem.scNumber || 'N/A'} {reworkItem.poNumber ? `(${reworkItem.poNumber})` : ''}
                  </span>
                </div>
              </div>
            </div>

            {/* Print Action Notice */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
              <Printer className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                A print preview tab was launched. If your browser blocked the popup, click the print button below.
              </span>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const rwId = reworkItem?.id;
                  const printUrl = rwId
                    ? `/dispatch/delivery-challan/${dispatchedDc.id}/print?reworkId=${rwId}`
                    : `/dispatch/delivery-challan/${dispatchedDc.id}/print`;
                  window.open(printUrl, '_blank');
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Delivery Challan</span>
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Locked Upstream Context Card */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Locked Upstream Traceability
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
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
                <div className="mt-1.5 pt-1.5 border-t border-slate-200 text-xs flex items-start gap-1.5 text-amber-800">
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
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    useOriginalVendor
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold block">Same Vendor</span>
                  <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                    {reworkItem.originalVendorName}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseOriginalVendor(false)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    !useOriginalVendor
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xs font-bold block">Alternative Vendor</span>
                  <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                    Assign to another vendor
                  </span>
                </button>
              </div>

              {/* Dynamic Vendor Info Banner */}
              {useOriginalVendor ? (
                <div className="p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center gap-2 text-xs text-blue-900">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  <div>
                    <span>Dispatches under <strong>Same DC # ({reworkItem.sourceDcNumber})</strong> with today's date (<strong>{todayFormatted}</strong>).</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-1 animate-in fade-in duration-150">
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

                  <div className="p-2.5 bg-purple-50/70 border border-purple-200/80 rounded-xl flex items-center gap-2 text-xs text-purple-900">
                    <Info className="w-4 h-4 text-purple-600 shrink-0" />
                    <div>
                      <span>Considered as an <strong>exact new DC</strong>: A new DC number will be assigned with today's date (<strong>{todayFormatted}</strong>).</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Fields for Alternative Vendor: Description & Remarks */}
            {!useOriginalVendor && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* Description */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Item Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required={!useOriginalVendor}
                    placeholder="Enter item description for new DC..."
                    className="w-full h-10 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                  />
                  <p className="text-[11px] text-slate-400">
                    This description will appear on the new supplier delivery challan line item.
                  </p>
                </div>

                {/* Remarks */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-800">
                    Remarks <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      required={!useOriginalVendor}
                      placeholder="Enter remarks and process instructions for the new vendor..."
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Target Return Date (SLA) */}
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

            {/* Same Vendor Notes / Instructions */}
            {useOriginalVendor && (
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
            )}

            {/* Footer Actions */}
            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reDispatchMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary-secondary transition-all shadow-sm disabled:opacity-50 cursor-pointer"
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
        )}
      </div>
    </div>
  );
}
