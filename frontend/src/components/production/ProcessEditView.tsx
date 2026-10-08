import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X, Lock, ArrowLeft } from 'lucide-react';
import type { ProductionProcessDto, UpdateProductionProcessDto } from '../../types/process-master.dto';

interface ProcessEditViewProps {
  isOpen: boolean;
  onClose: () => void;
  process: ProductionProcessDto | null;
  onSubmit: (id: string, data: UpdateProductionProcessDto) => void;
  isPending: boolean;
  hasAdminRights: boolean;
}

export function ProcessEditView({ isOpen, onClose, process, onSubmit, isPending, hasAdminRights }: ProcessEditViewProps) {
  const [isActiveToggle, setIsActiveToggle] = useState(false);

  const { register, handleSubmit, reset } = useForm<UpdateProductionProcessDto>({
    defaultValues: {
      expectedCycleTimeMs: 0,
      costCenter: '',
      description: ''
    }
  });

  useEffect(() => {
    if (isOpen && process) {
      reset({
        expectedCycleTimeMs: process.expectedCycleTimeMs,
        costCenter: process.costCenter,
        description: process.description,
      });
      setIsActiveToggle(process.isActive);
    }
  }, [isOpen, process, reset]);

  if (!isOpen || !process) return null;

  const handleToggle = () => {
    if (!hasAdminRights) return;
    setIsActiveToggle(!isActiveToggle);
  };

  const submitForm = (data: UpdateProductionProcessDto) => {
    onSubmit(process.id, {
      ...data,
      isActive: isActiveToggle
    });
  };

  return (
    <div className="max-w-3xl mx-auto w-full pb-12">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Process Directory</span>
        </button>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          Edit Process: {process.sequenceId}
        </span>
      </div>

      <div className="bg-white shadow-sm rounded-xl flex flex-col border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/50">
          <div>
            <div className="text-xs font-bold text-slate-500 tracking-wider uppercase mb-1">{process.sequenceId}</div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 leading-none">{process.nomenclature}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <form id="process-edit-form" onSubmit={handleSubmit(submitForm)} className="space-y-6">
            
            {/* Toggle Status */}
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Lifecycle Status</div>
                <div className="text-xs text-slate-500 mt-0.5">Determines if this process can be routed</div>
              </div>
              <div 
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                  isActiveToggle ? 'bg-blue-600' : 'bg-slate-200'
                } ${!hasAdminRights ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                onClick={handleToggle}
                title={!hasAdminRights ? 'Requires ADMIN or GENERAL_MANAGER role' : ''}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActiveToggle ? 'translate-x-6' : 'translate-x-1'}`} />
                {!hasAdminRights && <Lock className="absolute -left-5 w-3.5 h-3.5 text-slate-400" />}
              </div>
            </div>

            {/* Readonly Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Internal Code</label>
                <div className="text-sm font-mono text-slate-900">{process.internalCode}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Base UOM</label>
                <div className="text-sm text-slate-900">{process.baseUom}</div>
              </div>
            </div>

            {/* Editable Info */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Cycle Time (ms)</label>
              <input 
                type="number"
                {...register('expectedCycleTimeMs', { valueAsNumber: true })} disabled title="Not saved yet"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cost Center</label>
              <input 
                {...register('costCenter')} disabled title="Not saved yet"
                className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea 
                {...register('description')}
                rows={3}
                className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow resize-none"
              />
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-[12px] font-medium text-slate-500">
                Last modified by {process.lastModifiedBy || 'System'} on {process.lastModifiedAt || new Date().toISOString().split('T')[0]}
              </p>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 flex items-center bg-white text-slate-900 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            form="process-edit-form"
            disabled={isPending}
            className="h-10 px-6 flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
