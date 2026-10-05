import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { X, Plus, Trash2, ArrowRight, Check } from 'lucide-react';
import type { CreateProductionProcessDto, VendorDto } from '../../types/process-master.dto';

interface ProcessCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProductionProcessDto) => void;
  isPending: boolean;
  availableVendors: VendorDto[];
}

export function ProcessCreationWizard({ isOpen, onClose, onSubmit, isPending, availableVendors }: ProcessCreationWizardProps) {
  const [step, setStep] = useState(1);

  const { register, control, handleSubmit, reset, watch, setValue } = useForm<CreateProductionProcessDto>({
    defaultValues: {
      sequenceId: '',
      nomenclature: '',
      internalCode: '',
      description: '',
      baseUom: 'NOS',
      expectedCycleTimeMs: 0,
      costCenter: '',
      qcCheckpoints: [''],
      linkedVendorIds: []
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'qcCheckpoints' as never // Type workaround for flat string array
  });

  const watchLinkedVendors = watch('linkedVendorIds') || [];

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      reset();
    }
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const handleNext = () => setStep(prev => Math.min(prev + 1, 3));
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

  const toggleVendor = (vendorId: string) => {
    const isLinked = watchLinkedVendors.includes(vendorId);
    if (isLinked) {
      setValue('linkedVendorIds', watchLinkedVendors.filter(id => id !== vendorId));
    } else {
      setValue('linkedVendorIds', [...watchLinkedVendors, vendorId]);
    }
  };

  const submitForm = (data: CreateProductionProcessDto) => {
    // Filter out empty QC checkpoints
    data.qcCheckpoints = data.qcCheckpoints.filter(cp => cp.trim() !== '');
    onSubmit(data);
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white shadow-xl rounded-xl z-50 flex flex-col max-h-[90vh] border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Define Production Process</h2>
            <p className="text-xs text-slate-500 mt-1">Step {step} of 3: {step === 1 ? 'Basic Details' : step === 2 ? 'Technical Parameters' : 'Vendor Mapping'}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-white">
          <form id="process-wizard-form" onSubmit={handleSubmit(submitForm)} className="space-y-6">
            
            {/* STEP 1: Basic Details */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sequence ID</label>
                    <input 
                      {...register('sequenceId', { required: true })}
                      placeholder="e.g., SEQ-01"
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Internal Code</label>
                    <input 
                      {...register('internalCode', { required: true })}
                      placeholder="e.g., PR-CNC-01"
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Process Nomenclature</label>
                  <input 
                    {...register('nomenclature', { required: true })}
                    placeholder="e.g., High-Precision CNC Turning"
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea 
                    {...register('description')}
                    rows={3}
                    placeholder="Brief overview of the process operations..."
                    className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Base UOM</label>
                  <select 
                    {...register('baseUom')}
                    className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
                  >
                    <option value="NOS">Numbers (NOS)</option>
                    <option value="KG">Kilograms (KG)</option>
                    <option value="LTR">Liters (LTR)</option>
                    <option value="MTR">Meters (MTR)</option>
                  </select>
                </div>
              </div>
            )}

            {/* STEP 2: Technical Parameters */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Expected Cycle Time (ms)</label>
                    <input 
                      type="number"
                      {...register('expectedCycleTimeMs', { valueAsNumber: true })}
                      placeholder="e.g., 3600000"
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cost Center</label>
                    <input 
                      {...register('costCenter', { required: true })}
                      placeholder="e.g., CC-MFG-01"
                      className="w-full h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-slate-700">Quality Control Checkpoints</label>
                    <button 
                      type="button"
                      onClick={() => append('')}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Checkpoint
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center">
                        <div className="w-6 text-xs font-medium text-slate-400 text-right tabular-nums">{index + 1}.</div>
                        <input
                          {...register(`qcCheckpoints.${index}` as const)}
                          placeholder="e.g., Visual dimension check..."
                          className="flex-1 h-10 px-3.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 transition-shadow"
                        />
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Vendor Linkage */}
            {step === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <p className="text-sm text-slate-500 mb-2">Select the approved external vendors who are authorized to perform this process.</p>
                
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                  <div className="max-h-[300px] overflow-y-auto p-2">
                    {availableVendors.map((vendor) => {
                      const isSelected = watchLinkedVendors.includes(vendor.id);
                      return (
                        <div 
                          key={vendor.id}
                          onClick={() => toggleVendor(vendor.id)}
                          className={`flex items-center gap-3 p-3 mb-1 rounded-lg cursor-pointer border transition-colors ${
                            isSelected 
                              ? 'bg-blue-50/50 border-blue-200' 
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{vendor.vendorName}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{vendor.code}</div>
                          </div>
                        </div>
                      );
                    })}
                    {availableVendors.length === 0 && (
                      <div className="p-6 text-center text-sm text-slate-500">
                        No approved vendors found in the system.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-xl">
          <button
            type="button"
            onClick={step === 1 ? onClose : handlePrev}
            className="h-10 px-4 flex items-center bg-white text-slate-900 border border-slate-200 text-sm font-medium rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="h-10 px-5 flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 transition-all"
            >
              Next Step
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="submit"
              form="process-wizard-form"
              disabled={isPending}
              className="h-10 px-6 flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isPending ? 'Saving...' : 'Finalize & Create Process'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
