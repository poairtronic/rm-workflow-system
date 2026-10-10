import { useEffect, useState } from 'react';
import { useForm, FormProvider, Controller, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Loader2, Lock, Plus, Trash2, Printer, CheckCircle2 } from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import { DispatchPayloadGrid } from './DispatchPayloadGrid';
import { SearchSelect } from '../ui/SearchSelect';

export function Type1DispatchWizard() {
  const queryClient = useQueryClient();

  const methods = useForm<any>({
    defaultValues: {
      type: 'PRODUCTION_PROCESS_OUTWARD',
      vendorId: '',
      expectedReturnDate: '',
      scBlocks: [
        {
          scId: '',
          processId: '',
          items: [{ productId: '', binId: '', batchNumber: '', quantity: 0, description: '' }]
        }
      ]
    },
    mode: 'onChange'
  });

  const { register, watch, setValue, handleSubmit, formState: { isValid }, control } = methods;

  const vendorId = watch('vendorId');
  const scBlocks = watch('scBlocks');
  
  const { fields: blockFields, append: appendBlock, remove: removeBlock } = useFieldArray({
    control,
    name: 'scBlocks'
  });

  const { data: scList } = useQuery({ queryKey: ['sc'], queryFn: async () => unwrapList(await api.get<any[]>('/api/sc')) });
  const { data: processList } = useQuery({ queryKey: ['processes'], queryFn: async () => unwrapList(await api.get<any[]>('/api/production-processes')) });
  const { data: slaList } = useQuery({ queryKey: ['vendor-slas'], queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors/slas')) });

  // Auto-calculate expected return date from real SLA slaDays
  // Using the first processId as the driver for SLA, if it exists
  const firstProcessId = scBlocks?.[0]?.processId;
  useEffect(() => {
    if (vendorId && firstProcessId && slaList && slaList.length > 0) {
      const sla = slaList.find((s: any) => s.vendorId === vendorId && s.processId === firstProcessId);
      if (sla?.slaDays) {
        const date = new Date();
        date.setDate(date.getDate() + Number(sla.slaDays));
        setValue('expectedReturnDate', date.toISOString().split('T')[0]);
      }
    }
  }, [vendorId, firstProcessId, slaList, setValue]);

  const [generatedDc, setGeneratedDc] = useState<any | null>(null);

  const createDcMutation = useMutation({
    mutationFn: (data: any) => deliveryChallanApi.create(data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      const dcNum = res.challanNumber || res.dcNumber || 'DC';
      toast.success(`Delivery Challan ${dcNum} locked successfully!`);
      setGeneratedDc(res);
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

  const onSubmit = (data: any) => {
    const payload = {
      type: data.type,
      vendorId: data.vendorId,
      dispatchDate: new Date().toISOString(),
      expectedReturnDate: data.expectedReturnDate,
      items: data.scBlocks.flatMap((block: any) => 
        block.items.map((item: any) => ({
          ...item,
          productId: item.productId || undefined,
          binId: item.binId || undefined,
          scId: block.scId,
          processId: block.processId,
          partNumber: item.partNumber || undefined,
          partName: item.partName || undefined,
          quantityDispatched: Number(item.quantity)
        }))
      )
    };
    createDcMutation.mutate(payload);
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      {/* Post-Generation Success Card with Print Action */}
      {generatedDc && (
        <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-blue-950">
                  Delivery Challan Generated: <span className="font-mono text-blue-700">{generatedDc.challanNumber || generatedDc.dcNumber}</span>
                </h3>
                <p className="text-xs text-blue-800 mt-1">
                  External processing dispatch is authorized and stock has been deducted.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setGeneratedDc(null)}
                className="px-4 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 rounded-lg border border-blue-200 bg-white transition-colors cursor-pointer"
              >
                Create Another DC
              </button>
              <button
                type="button"
                onClick={() => window.open(`/dispatch/delivery-challan/${generatedDc.id}/print`, '_blank')}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Supplier DC
              </button>
            </div>
          </div>
        </div>
      )}

      <FormProvider {...methods}>
        <form id="dc-wizard-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Section 1: Vendor & Date (Global DC Level) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
              Vendor Authorization
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                      options={slaList?.map((s: any) => ({
                        id: s.vendorId,
                        primary: s.vendor?.name || 'Unknown Vendor'
                      })) || []}
                    />
                  )}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return Date</label>
                <input
                  type="date"
                  {...register('expectedReturnDate', { required: 'Expected Return Date is required' })}
                  className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tabular-nums cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-slate-500">Universal SLA date. Auto-calculated based on first process SLA.</p>
              </div>
            </div>
          </div>

          {/* Section 2: SC Blocks */}
          <div className="space-y-6">
            {blockFields.map((block, index) => (
              <div key={block.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 relative">
                {blockFields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    className="absolute top-6 right-6 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                
                <h3 className="text-[13px] font-semibold text-slate-900 mb-4 uppercase tracking-wide flex items-center gap-2">
                  Dispatch Group {index + 1}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sales Component (SC Code)</label>
                    <Controller
                      name={`scBlocks.${index}.scId`}
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
                      name={`scBlocks.${index}.processId`}
                      control={methods.control}
                      rules={{ required: 'Process is required' }}
                      render={({ field }) => {
                        const scId = watch(`scBlocks.${index}.scId`);
                        return (
                          <SearchSelect
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="Select Process..."
                            disabled={!scId || !vendorId}
                            options={processList?.map((p: any) => ({
                              id: p.id,
                              primary: `${p.code} - ${p.name}`
                            })) || []}
                          />
                        );
                      }}
                    />
                  </div>
                </div>

                <DispatchPayloadGrid blockIndex={index} />
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => appendBlock({ scId: '', processId: '', items: [{ productId: '', binId: '', batchNumber: '', quantity: 0, description: '' }] })}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors border border-slate-200"
            >
              <Plus className="w-4 h-4" />
              Add Another Dispatch Group (SC)
            </button>
          </div>

          {/* Footer Action */}
          <div className="pt-6 mt-6 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              disabled={!isValid || createDcMutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-8 h-12 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20"
            >
              {createDcMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {createDcMutation.isPending ? 'Generating DC...' : 'Lock & Generate Delivery Challan'}
            </button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
