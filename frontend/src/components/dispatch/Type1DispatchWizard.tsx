import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronRight, Loader2, Lock } from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';
import { DispatchPayloadGrid } from './DispatchPayloadGrid';
import { DispatchReviewView } from './DispatchReviewView';

const STEPS = [
  { id: 1, name: 'Context' },
  { id: 2, name: 'Vendor & SLA' },
  { id: 3, name: 'Payload' },
  { id: 4, name: 'Review' },
];

export function Type1DispatchWizard() {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  const methods = useForm<CreateDeliveryChallanDto>({
    defaultValues: {
      type: 'PRODUCTION_OUTWARD',
      scCode: '',
      processId: '',
      vendorId: '',
      expectedReturnDate: '',
      items: [{ materialCode: '', sourceBinId: '', batchNumber: '', quantity: 0, uom: 'KG' }]
    },
    mode: 'onChange'
  });

  const { register, watch, setValue, trigger, handleSubmit, formState: { isValid } } = methods;

  const scCode = watch('scCode');
  const processId = watch('processId');

  // Auto-calculate expected return date for step 2 simulation
  useEffect(() => {
    if (currentStep === 2) {
      // Hardcoded 5-day SLA for demonstration
      const returnDate = new Date();
      returnDate.setDate(returnDate.getDate() + 5);
      setValue('expectedReturnDate', returnDate.toISOString().split('T')[0]);
    }
  }, [currentStep, setValue]);

  const createDcMutation = useMutation({
    mutationFn: (data: CreateDeliveryChallanDto) => deliveryChallanApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success(`Delivery Challan ${res.dcNumber || 'created'} locked successfully!`);
      // Reset or redirect would happen here
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (error: any) => {
      const status = error.response?.status;
      if (status === 400) {
        toast.error('Insufficient stock or validation failure', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      } else if (status === 403) {
        toast.error('Unauthorized DC Generation Attempt', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      } else {
        toast.error('Failed to generate DC', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      }
    }
  });

  const handleNext = async () => {
    let fieldsToValidate: any = [];
    if (currentStep === 1) fieldsToValidate = ['scCode', 'processId'];
    if (currentStep === 2) fieldsToValidate = ['vendorId', 'expectedReturnDate'];
    if (currentStep === 3) fieldsToValidate = ['items'];

    const isStepValid = await trigger(fieldsToValidate);
    if (isStepValid) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const onSubmit = (data: CreateDeliveryChallanDto) => {
    createDcMutation.mutate(data);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Wizard Progress Bar */}
      <nav aria-label="Progress" className="mb-8">
        <ol role="list" className="flex items-center">
          {STEPS.map((step, stepIdx) => (
            <li key={step.name} className={`${stepIdx !== STEPS.length - 1 ? 'pr-8 sm:pr-20' : ''} relative`}>
              {stepIdx !== STEPS.length - 1 && (
                <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-0.5 mt-0.5 bg-slate-200">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: currentStep > step.id ? '100%' : '0%' }}
                  />
                </div>
              )}
              <div className="relative flex items-center justify-center">
                <span
                  className={`h-8 w-8 rounded-full flex items-center justify-center border-2 text-xs font-semibold bg-white transition-colors duration-300 ${
                    currentStep > step.id
                      ? 'border-primary bg-primary text-white'
                      : currentStep === step.id
                      ? 'border-primary text-primary'
                      : 'border-slate-300 text-slate-500'
                  }`}
                >
                  {currentStep > step.id ? <CheckCircle2 className="w-5 h-5" /> : step.id}
                </span>
                <span className={`absolute -bottom-6 text-xs font-medium whitespace-nowrap ${
                  currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'
                }`}>
                  {step.name}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </nav>

      {/* Form Content */}
      <div className="mt-12">
        <FormProvider {...methods}>
          <form id="dc-wizard-form" onSubmit={handleSubmit(onSubmit)}>
            
            {/* Step 1: Context */}
            <div className={currentStep === 1 ? 'block' : 'hidden'}>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
                  Dispatch Context
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sales Component (SC Code)</label>
                    <select
                      {...register('scCode', { required: 'SC Code is required' })}
                      className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select SC Code...</option>
                      <option value="SC-2026-004">SC-2026-004 (Aerospace Assembly)</option>
                      <option value="SC-2026-009">SC-2026-009 (Automotive Drive)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Production Process</label>
                    <select
                      {...register('processId', { required: 'Process is required' })}
                      disabled={!scCode}
                      className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400"
                    >
                      <option value="">Select Process...</option>
                      <option value="PRC-CNC-01">CNC Turning</option>
                      <option value="PRC-HT-01">Heat Treatment</option>
                      <option value="PRC-ANO-01">Anodizing</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Vendor & SLA */}
            <div className={currentStep === 2 ? 'block' : 'hidden'}>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
                <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
                  Vendor Authorization
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Authorized External Vendor</label>
                    <select
                      {...register('vendorId', { required: 'Vendor is required' })}
                      className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    >
                      <option value="">Select Vendor...</option>
                      <option value="VND-APX-001">Apex Processors Ltd.</option>
                      <option value="VND-ST-002">SteelTech Industries</option>
                    </select>
                    <p className="mt-1 text-[11px] text-slate-500">Filtered by active SLA for {processId}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return Date</label>
                    <input
                      type="date"
                      readOnly
                      {...register('expectedReturnDate')}
                      className="w-full h-10 px-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 focus:outline-none tabular-nums cursor-not-allowed"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">Auto-calculated from SLA terms (+5 days)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Payload Grid */}
            <div className={currentStep === 3 ? 'block' : 'hidden'}>
              <DispatchPayloadGrid />
            </div>

            {/* Step 4: Review */}
            <div className={currentStep === 4 ? 'block' : 'hidden'}>
              <DispatchReviewView />
            </div>
          </form>
        </FormProvider>
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          disabled={currentStep === 1 || createDcMutation.isPending}
          className="px-6 h-10 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Back
        </button>
        
        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Next Step
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="submit"
            form="dc-wizard-form"
            disabled={!isValid || createDcMutation.isPending}
            className="inline-flex items-center justify-center gap-2 px-6 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createDcMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {createDcMutation.isPending ? 'Generating DC...' : 'Lock & Generate DC'}
          </button>
        )}
      </div>
    </div>
  );
}
