import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';
import { DispatchPayloadRow } from './DispatchPayloadRow';

export function DispatchPayloadGrid() {
  const { control, formState: { errors } } = useFormContext<CreateDeliveryChallanDto>();
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Material Payload</h2>
          <p className="text-xs text-slate-500 mt-1">Specify items, batches, and quantities to dispatch</p>
        </div>
        <button
          type="button"
          onClick={() => append({ productId: '', binId: '', batchNumber: '', quantity: 0, uom: 'KG' })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-md hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 w-1/4">Material Code / Name</th>
              <th className="px-4 py-2 w-1/4">Source Bin</th>
              <th className="px-4 py-2 w-1/5">Batch / Heat No.</th>
              <th className="px-4 py-2 text-right w-32">Quantity</th>
              <th className="px-4 py-2 w-20">UOM</th>
              <th className="px-4 py-2 text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((item, index) => (
              <DispatchPayloadRow 
                key={item.id} 
                index={index} 
                remove={remove} 
                canRemove={fields.length > 1} 
              />
            ))}
          </tbody>
        </table>
        {errors.items && (
          <p className="mt-2 text-sm text-red-500 font-medium">Please ensure all row fields are correctly filled.</p>
        )}
      </div>
    </div>
  );
}
