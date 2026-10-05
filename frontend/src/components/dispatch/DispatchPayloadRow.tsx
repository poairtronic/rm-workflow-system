import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';

export function DispatchPayloadRow({ index, remove, canRemove }: { index: number, remove: (i: number) => void, canRemove: boolean }) {
  const { register, control, setValue } = useFormContext();
  
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => unwrapList(await api.get<any[]>('/api/products')) });
  
  const productId = useWatch({ control, name: `items.${index}.productId` });
  const binId = useWatch({ control, name: `items.${index}.binId` });
  const dispatchQty = useWatch({ control, name: `items.${index}.quantity` });
  
  const { data: balances = [] } = useQuery({
    queryKey: ['balances', productId],
    queryFn: async () => unwrapList(await api.get<any[]>(`/api/inventory/balances?productId=${productId}`)),
    enabled: !!productId
  });

  useEffect(() => {
    // Reset bin when product changes
    setValue(`items.${index}.binId`, '');
    setValue(`items.${index}.quantity`, 0);
  }, [productId, setValue, index]);

  const selectedBalance = balances.find(b => b.binId === binId);
  const availableQty = selectedBalance ? selectedBalance.currentQuantity : 0;
  
  // Dynamic UOM based on product
  const product = products?.find(p => p.id === productId);
  const uom = product?.uom || 'NOS';
  
  // Set UOM dynamically
  useEffect(() => {
    if (product) setValue(`items.${index}.uom`, product.uom);
  }, [product, setValue, index]);

  const isQtyInvalid = dispatchQty > availableQty || dispatchQty <= 0;

  return (
    <>
      <tr className="h-14">
        <td className="px-4 py-2">
          <select
            {...register(`items.${index}.productId` as const, { required: 'Required' })}
            className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Select Product...</option>
            {products?.map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
          </select>
        </td>
        <td className="px-4 py-2">
          <select
            {...register(`items.${index}.binId` as const, { required: 'Required' })}
            className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={!productId || balances.length === 0}
          >
            <option value="">Select Bin...</option>
            {balances.map(b => (
              <option key={b.binId} value={b.binId}>{b.binCode} ({b.currentQuantity} {uom})</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-2">
          <input
            {...register(`items.${index}.batchNumber` as const, { required: 'Required' })}
            className="w-full h-9 px-3 rounded-md bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="HT-992"
          />
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex flex-col">
            <input
              type="number"
              step="0.1"
              {...register(`items.${index}.quantity` as const, { 
                required: 'Required',
                validate: v => (v > 0 && v <= availableQty) || 'Invalid Quantity'
              })}
              className={`w-full h-9 px-3 rounded-md bg-white border text-sm text-slate-900 text-right tabular-nums focus:outline-none focus:ring-2 focus:border-transparent ${isQtyInvalid && binId ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'}`}
            />
            {isQtyInvalid && binId && <span className="text-[10px] text-red-500 font-medium mt-1">Avail: {availableQty}</span>}
            {!isQtyInvalid && binId && <span className="text-[10px] text-slate-500 font-medium mt-1">Avail: {availableQty}</span>}
          </div>
        </td>
        <td className="px-4 py-2">
          <input
            {...register(`items.${index}.uom` as const)}
            readOnly
            className="w-full h-9 px-2 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-500 focus:outline-none cursor-not-allowed"
          />
        </td>
        <td className="px-4 py-2 text-center">
          <button
            type="button"
            onClick={() => remove(index)}
            disabled={!canRemove}
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    </>
  );
}
