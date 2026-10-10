import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { DispatchPayloadRow } from './DispatchPayloadRow';

export function DispatchPayloadGrid({ blockIndex }: { blockIndex: number }) {
  const { control, formState: { errors }, watch } = useFormContext<any>();
  const dcType = watch('type');
  const isType1 = dcType === 'PRODUCTION_PROCESS_OUTWARD';
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: `scBlocks.${blockIndex}.items`
  });

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mt-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Items Payload</h3>
        </div>
        <button
          type="button"
          onClick={() => append({ productId: '', binId: '', batchNumber: '', quantity: 0, uom: 'KG', description: '' })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-8 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2 w-1/4">{isType1 ? 'Part Name' : 'Material'}</th>
              {!isType1 && <th className="px-3 py-2 w-36">Rack</th>}
              {!isType1 && <th className="px-3 py-2 w-44">Bin</th>}
              <th className="px-3 py-2 w-1/6">Batch / Heat No.</th>
              <th className="px-3 py-2 w-1/4">Description (Opt)</th>
              <th className="px-3 py-2 text-right w-28">Quantity</th>
              <th className="px-3 py-2 text-center w-12">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {fields.map((item, index) => (
                <DispatchPayloadRow 
                  key={item.id} 
                  blockIndex={blockIndex}
                  index={index} 
                  remove={remove} 
                  canRemove={fields.length > 1}
                  isType1={isType1}
                />
            ))}
          </tbody>
        </table>
        {(errors as any).scBlocks?.[blockIndex]?.items && (
          <p className="mt-2 text-sm text-red-500 font-medium">Please ensure all row fields are correctly filled.</p>
        )}
      </div>
    </div>
  );
}
