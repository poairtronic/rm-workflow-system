import { useForm } from 'react-hook-form';
import { X, Lock, AlertTriangle } from 'lucide-react';
import type { VendorSlaDto, SlaOverrideDto } from '../../types/vendor-sla.dto';

interface SlaOverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  sla: VendorSlaDto | null;
  hasOverrideAccess: boolean;
  onSubmit: (data: SlaOverrideDto) => void;
}

export function SlaOverrideModal({ isOpen, onClose, sla, hasOverrideAccess, onSubmit }: SlaOverrideModalProps) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<SlaOverrideDto>();

  if (!isOpen || !sla) return null;

  const handleFormSubmit = (data: SlaOverrideDto) => {
    onSubmit(data);
    reset();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Lock className={`w-5 h-5 ${hasOverrideAccess ? 'text-amber-600' : 'text-slate-400'}`} />
            <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
              SLA Exception Override
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Access Warning */}
        {!hasOverrideAccess && (
          <div className="bg-red-50 border-b border-red-100 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Access Denied</p>
              <p className="text-xs text-red-600 mt-0.5">You do not have Manager/Admin privileges to override SLA terms.</p>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Target SLA Profile</p>
            <p className="text-sm font-semibold text-slate-900">{sla.vendorName}</p>
            <p className="text-sm text-slate-600">{sla.processName}</p>
          </div>

          <form id="override-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                New Target Date
              </label>
              <input
                type="date"
                disabled={!hasOverrideAccess}
                {...register('newTargetDate', { required: 'Target date is required' })}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
              />
              {errors.newTargetDate && (
                <p className="mt-1 text-xs text-red-500">{errors.newTargetDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Justification Code
              </label>
              <select
                disabled={!hasOverrideAccess}
                {...register('justificationCode', { required: 'Code is required' })}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-slate-100 disabled:text-slate-500"
              >
                <option value="">Select a reason...</option>
                <option value="RM_DEFECT">Raw Material Defect</option>
                <option value="TRANSIT_STRIKE">Transit/Logistics Strike</option>
                <option value="MACHINE_DOWN">Vendor Machine Breakdown</option>
                <option value="FORCE_MAJEURE">Force Majeure</option>
              </select>
              {errors.justificationCode && (
                <p className="mt-1 text-xs text-red-500">{errors.justificationCode.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Override Notes
              </label>
              <textarea
                disabled={!hasOverrideAccess}
                {...register('justificationNotes', { required: 'Notes are required' })}
                rows={3}
                className="w-full p-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="Detail the operational delays..."
              />
              {errors.justificationNotes && (
                <p className="mt-1 text-xs text-red-500">{errors.justificationNotes.message}</p>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-10 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="override-form"
            disabled={!hasOverrideAccess || isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-4 h-10 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            {isSubmitting ? 'Processing...' : 'Confirm Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
