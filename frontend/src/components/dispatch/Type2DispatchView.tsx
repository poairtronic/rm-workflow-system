import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ClipboardList } from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import { useQuery } from '@tanstack/react-query';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';
import { DispatchPayloadGrid } from './DispatchPayloadGrid';
import { Type2ReviewModal } from './Type2ReviewModal';

export function Type2DispatchView() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: vendorList } = useQuery({ queryKey: ['vendors'], queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors?isActive=true')) });
  
  const methods = useForm<CreateDeliveryChallanDto>({
    defaultValues: {
      type: 'GENERAL_INVENTORY_OUTWARD',
      scCode: 'N/A',
      processId: 'N/A',
      vendorId: '',
      notes: '',
      items: []
    },
    mode: 'onChange'
  });

  const { register, handleSubmit, watch, formState: { isValid, errors } } = methods;
  const items = watch('items') || [];
  
  // Custom validation to ensure no item has errors (like exceeding max stock)
  // `isValid` from react-hook-form handles most of this automatically based on our field rules.
  const isFormValid = isValid && items.length > 0;

  const createDcMutation = useMutation({
    mutationFn: (data: CreateDeliveryChallanDto) => deliveryChallanApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success(`Delivery Challan ${res.dcNumber || 'created'} generated successfully!`, {
        style: { background: '#DCFCE7', color: '#15803D' }
      });
      setIsModalOpen(false);
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: () => {
      toast.error('Failed to generate DC', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      setIsModalOpen(false);
    }
  });

  const onReview = () => {
    setIsModalOpen(true);
  };

  const onConfirm = () => {
    handleSubmit((data) => {
      const payload = {
        ...data,
        items: data.items.map(item => ({
          ...item,
          quantityDispatched: Number(item.quantity)
        }))
      };
      createDcMutation.mutate(payload);
    })();
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-24">
      <FormProvider {...methods}>
        <form>
          {/* Context Card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
              Dispatch Context
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vendor Destination</label>
                <select
                  {...register('vendorId', { required: 'Destination is required' })}
                  className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select Vendor...</option>
                  {vendorList?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                {errors.vendorId && (
                  <p className="mt-1 text-xs text-red-500">{errors.vendorId.message}</p>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                {...register('notes', { required: 'Purpose is required' })}
                placeholder="E.g., R&D Testing, Machine Maintenance..."
                className="w-full min-h-[80px] p-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
              />
              {errors.notes && (
                <p className="mt-1 text-xs text-red-500">{errors.notes.message}</p>
              )}
            </div>
          </div>

          {/* Payload Selector Grid */}
          <DispatchPayloadGrid />
        </form>
        

      {/* Sticky Action Footer */}
      <div className="fixed bottom-0 left-[260px] right-0 p-4 bg-white border-t border-slate-200 z-20 flex justify-end shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
        <div className="max-w-5xl mx-auto w-full flex justify-end">
          <button
            type="button"
            onClick={onReview}
            disabled={!isFormValid}
            className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ClipboardList className="w-4 h-4" />
            Review Dispatch
          </button>
        </div>
      </div>

      <Type2ReviewModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={onConfirm}
        isSubmitting={createDcMutation.isPending}
      />
      </FormProvider>
    </div>
  );
}
