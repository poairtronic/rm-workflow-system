import { useFieldArray, useFormContext } from 'react-hook-form';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { deliveryChallanApi } from '../../services/api';
import { DispatchPayloadRow } from './DispatchPayloadRow';

export function DispatchPayloadGrid({ blockIndex }: { blockIndex: number }) {
  const { control, formState: { errors }, watch } = useFormContext<any>();
  const dcType = watch('type');
  const isType1 = dcType === 'PRODUCTION_PROCESS_OUTWARD';
  
  const { data: seqData } = useQuery({
    queryKey: ['next-type2-item-sequence'],
    queryFn: () => deliveryChallanApi.getNextType2ItemSequence(),
    enabled: !isType1,
    staleTime: 5000,
  });

  const baseSeq = seqData?.nextSequence ?? 1;

  const { fields, append, remove } = useFieldArray({
    control,
    name: `scBlocks.${blockIndex}.items`
  });

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 mt-6">
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Items Payload</h3>
          <p className="text-xs text-slate-500">
            {isType1
              ? 'Specify the production process items and quantities being dispatched to the vendor.'
              : 'Specify internal RM warehouse items dispatched and their converted return items.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => append({ 
            scItemId: '', 
            productId: '', 
            partNumber: !isType1 ? `DC2-${String(baseSeq + fields.length).padStart(3, '0')}` : '', 
            partName: '', 
            binId: '', 
            batchNumber: '', 
            quantity: '' as any, 
            outputProductId: '', 
            expectedOutputQuantity: '' as any, 
            outputBinId: '', 
            uom: 'NOS', 
            description: '' 
          })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4 text-primary" />
          Add Item
        </button>
      </div>

      <div className="space-y-4">
        {fields.map((item, index) => (
          <DispatchPayloadRow 
            key={item.id} 
            blockIndex={blockIndex}
            index={index} 
            remove={remove} 
            canRemove={fields.length > 1}
            isType1={isType1}
            baseSeq={baseSeq}
          />
        ))}
        {(errors as any).scBlocks?.[blockIndex]?.items && (
          <p className="mt-2 text-sm text-red-500 font-medium">Please ensure all item fields are correctly filled.</p>
        )}
      </div>
    </div>
  );
}
