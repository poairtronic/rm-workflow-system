import { useForm, Controller } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, PackagePlus } from 'lucide-react';
import { api } from '../services/api';
import { ProductSelect } from '../components/inventory/ProductSelect';
import { BinSelect } from '../components/inventory/BinSelect';
import { VendorSelect } from '../components/dispatch/VendorSelect';

interface GrnForm {
  productId: string;
  binId: string;
  vendorId: string;
  quantity: number;
  poNumber?: string;
  challanNumber?: string;
  notes?: string;
}

export function SupplierInwardWorkspace() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<GrnForm>({
    defaultValues: {
      productId: '',
      binId: '',
      vendorId: '',
      quantity: 0,
      poNumber: '',
      challanNumber: '',
      notes: ''
    }
  });

  const grnMutation = useMutation({
    mutationFn: async (data: GrnForm) => {
      const payload = {
        productId: data.productId,
        binId: data.binId,
        quantity: Number(data.quantity),
        referenceId: data.poNumber || data.challanNumber || undefined,
        reason: 'Supplier Inward (GRN)',
        remarks: `Vendor: ${data.vendorId}. ${data.notes || ''}`
      };
      return api.post('/api/inventory/grn', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockBalances'] });
      toast.success('Goods received successfully. Stock updated.');
      reset();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to process GRN');
    }
  });

  const onSubmit = (data: GrnForm) => {
    if (data.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    grnMutation.mutate(data);
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-12">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Download className="w-6 h-6 text-primary" />
          Supplier Inward (GRN)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Receive fresh raw material stock from suppliers.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-slate-400" />
          <h2 className="font-semibold text-slate-800">New Goods Receipt Note</h2>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product <span className="text-red-500">*</span></label>
              <Controller
                control={control}
                name="productId"
                rules={{ required: 'Product is required' }}
                render={({ field }) => (
                  <ProductSelect 
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.productId?.message}
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destination Bin <span className="text-red-500">*</span></label>
              <Controller
                control={control}
                name="binId"
                rules={{ required: 'Bin is required' }}
                render={({ field }) => (
                  <BinSelect 
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.binId?.message}
                  />
                )}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier / Vendor <span className="text-red-500">*</span></label>
              <Controller
                control={control}
                name="vendorId"
                rules={{ required: 'Vendor is required' }}
                render={({ field }) => (
                  <VendorSelect 
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.vendorId?.message}
                  />
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Received Quantity <span className="text-red-500">*</span></label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                {...register('quantity', { required: 'Quantity is required', min: { value: 0.001, message: 'Must be > 0' } })}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                placeholder="Enter quantity..."
              />
              {errors.quantity && <p className="mt-1 text-xs text-red-500">{errors.quantity.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">PO Number (Optional)</label>
              <input
                type="text"
                {...register('poNumber')}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                placeholder="e.g. PO-2024-001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier Challan (Optional)</label>
              <input
                type="text"
                {...register('challanNumber')}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                placeholder="e.g. CH-9923"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Inspection Notes</label>
            <textarea
              {...register('notes')}
              className="w-full min-h-[80px] p-3 rounded-lg border border-slate-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors resize-y"
              placeholder="Any remarks regarding quality, condition, or delivery..."
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={grnMutation.isPending}
              className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 focus:ring-4 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {grnMutation.isPending ? 'Processing...' : 'Confirm Receipt & Update Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
