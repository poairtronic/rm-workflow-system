import { useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ClipboardList, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import { DispatchPayloadGrid } from './DispatchPayloadGrid';

export function Type2DispatchView() {
  const queryClient = useQueryClient();
  const [isReviewing, setIsReviewing] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const { data: vendorList } = useQuery({ 
    queryKey: ['vendors'], 
    queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors?isActive=true')) 
  });
  
  const methods = useForm<any>({
    defaultValues: {
      type: 'GENERAL_INVENTORY_OUTWARD',
      vendorId: '',
      notes: '',
      scBlocks: [{ scId: null, processId: null, items: [] }]
    },
    mode: 'onChange'
  });

  const { register, handleSubmit, watch, formState: { isValid, errors } } = methods;
  const items = watch('scBlocks')?.[0]?.items || [];
  const vendorId = watch('vendorId');
  const notes = watch('notes');
  const selectedVendor = vendorList?.find((v: any) => v.id === vendorId);

  const isFormValid = isValid && items.length > 0;

  const createDcMutation = useMutation({
    mutationFn: (data: any) => deliveryChallanApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success(`Delivery Challan ${res.dcNumber || 'created'} generated successfully!`, {
        style: { background: '#DCFCE7', color: '#15803D' }
      });
      setIsReviewing(false);
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: () => {
      toast.error('Failed to generate DC', { style: { background: '#FEF2F2', color: '#B91C1C' } });
    }
  });

  const onConfirm = () => {
    handleSubmit((data) => {
      const payload = {
        ...data,
        items: data.scBlocks[0].items.map((item: any) => ({
          ...item,
          quantityDispatched: Number(item.quantity)
        }))
      };
      createDcMutation.mutate(payload);
    })();
  };

  return (
    <div className="w-full max-w-5xl mx-auto pb-16">
      <FormProvider {...methods}>
        {!isReviewing ? (
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
                    <p className="mt-1 text-xs text-red-500">{errors.vendorId.message as string}</p>
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
                  <p className="mt-1 text-xs text-red-500">{errors.notes.message as string}</p>
                )}
              </div>
            </div>

            {/* Payload Selector Grid */}
            <DispatchPayloadGrid blockIndex={0} />

            {/* Action Bar */}
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReviewing(true)}
                disabled={!isFormValid}
                className="inline-flex items-center gap-2 px-6 h-11 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ClipboardList className="w-4 h-4" />
                Review Dispatch
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsReviewing(false)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Dispatch Form</span>
              </button>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Step 2: Review & Confirm
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Send className="w-5 h-5 text-primary" />
                    Review General Dispatch
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    Verify destination and material quantities before issuing the delivery challan.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Destination Entity</p>
                    <p className="text-sm font-bold text-slate-900">{selectedVendor?.name || 'Selected Vendor'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Total Line Items</p>
                    <p className="text-sm font-bold text-slate-900 tabular-nums">{items.length}</p>
                  </div>
                  <div className="sm:col-span-2 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">Purpose / Notes</p>
                    <p className="text-sm text-slate-800">{notes || 'No notes provided'}</p>
                  </div>
                </div>

                {/* Condensed Table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wide mb-3">Payload Summary</h3>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase text-slate-600">
                        <tr>
                          <th className="px-4 py-2.5">Material</th>
                          <th className="px-4 py-2.5">Bin</th>
                          <th className="px-4 py-2.5 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-medium text-slate-900">{item.materialCode || item.productId || 'Item'}</td>
                            <td className="px-4 py-2.5 text-slate-600">{item.sourceBinId || '-'}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{item.quantity} {item.uom || ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Authorization Checkbox */}
                <label className="flex items-start gap-3 p-4 bg-blue-50/70 border border-blue-100 rounded-lg cursor-pointer">
                  <div className="flex items-center h-5">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      checked={isConfirmed}
                      onChange={(e) => setIsConfirmed(e.target.checked)}
                    />
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-blue-900 block">I confirm this general dispatch is authorized.</span>
                    <span className="text-blue-700 text-xs">This action will permanently deduct stock from the selected bins and generate an immutable ledger entry.</span>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsReviewing(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-lg bg-white transition-colors"
                >
                  Back to Edit
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={!isConfirmed || createDcMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createDcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {createDcMutation.isPending ? 'Generating...' : 'Generate DC'}
                </button>
              </div>
            </div>
          </div>
        )}
      </FormProvider>
    </div>
  );
}
