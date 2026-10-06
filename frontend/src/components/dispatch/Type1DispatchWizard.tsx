import { useState, useEffect } from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { CheckCircle2, ChevronRight, Loader2, Lock } from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';
import { DispatchPayloadGrid } from './DispatchPayloadGrid';
import { DispatchReviewView } from './DispatchReviewView';
import { SearchSelect } from '../ui/SearchSelect';

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
      type: 'PRODUCTION_PROCESS_OUTWARD',
      scId: '',
      processId: '',
      vendorId: '',
      expectedReturnDate: '',
      items: [{ productId: '', binId: '', batchNumber: '', quantity: 0, uom: 'KG' }]
    },
    mode: 'onChange'
  });

  const { register, watch, setValue, trigger, handleSubmit, formState: { isValid } } = methods;

  const scId = watch('scId');
  
  const processId = watch('processId');
  const vendorId = watch('vendorId');

  const { data: scList } = useQuery({ queryKey: ['sc'], queryFn: async () => unwrapList(await api.get<any[]>('/api/sc')) });
  const { data: processList } = useQuery({ queryKey: ['processes'], queryFn: async () => unwrapList(await api.get<any[]>('/api/production-processes')) });
  const { data: slaList } = useQuery({ queryKey: ['vendor-slas'], queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors/slas')) });

  // Auto-calculate expected return date from real SLA slaDays
  useEffect(() => {
    if (vendorId && processId && slaList && slaList.length > 0) {
      const sla = slaList.find((s: any) => s.vendorId === vendorId && s.processId === processId);
      if (sla?.slaDays) {
        const date = new Date();
        date.setDate(date.getDate() + Number(sla.slaDays));
        setValue('expectedReturnDate', date.toISOString().split('T')[0]);
      }
    }
  }, [vendorId, processId, slaList, setValue]);

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
    const payload = {
      ...data,
      items: data.items.map(item => ({
        ...item,
        quantityDispatched: Number(item.quantity)
      }))
    };
    createDcMutation.mutate(payload);
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
                    <Controller
                      name="scId"
                      control={methods.control}
                      rules={{ required: 'SC Code is required' }}
                      render={({ field }) => (
                        <SearchSelect
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select SC Code..."
                          options={scList?.map((sc: any) => ({
                            id: sc.id,
                            primary: sc.scNumber,
                            secondary: sc.purchaseOrder?.poNumber || 'No PO'
                          })) || []}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Production Process</label>
                    <Controller
                      name="processId"
                      control={methods.control}
                      rules={{ required: 'Process is required' }}
                      render={({ field }) => (
                        <SearchSelect
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Process..."
                          disabled={!scId}
                          options={processList?.map((p: any) => ({
                            id: p.id,
                            primary: `${p.code} - ${p.name}`
                          })) || []}
                        />
                      )}
                    />
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
                    <Controller
                      name="vendorId"
                      control={methods.control}
                      rules={{ required: 'Vendor is required' }}
                      render={({ field }) => (
                        <SearchSelect
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select Vendor..."
                          disabled={!processId}
                          options={slaList?.filter((s: any) => s.processId === processId).map((s: any) => ({
                            id: s.vendorId,
                            primary: s.vendorName
                          })) || []}
                        />
                      )}
                    />
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
