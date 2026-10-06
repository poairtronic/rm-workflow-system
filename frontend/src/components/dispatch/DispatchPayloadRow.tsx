import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';

export function DispatchPayloadRow({ blockIndex, index, remove, canRemove }: { blockIndex: number, index: number, remove: (i: number) => void, canRemove: boolean }) {
  const { register, control, setValue } = useFormContext();
  
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => unwrapList(await api.get<any[]>('/api/products')) });
  
  const scId = useWatch({ control, name: `scBlocks.${blockIndex}.scId` });
  const { data: selectedSc } = useQuery({
    queryKey: ['sc', scId],
    queryFn: async () => {
      if (!scId) return null;
      const res = await api.get<any>(`/api/sc/${scId}`);
      return res.data?.data || res.data;
    },
    enabled: !!scId
  });

  const scProductIds = selectedSc?.rmRequest?.items?.map((i: any) => i.mappedProductId || i.productId).filter(Boolean);
  const availableProducts = scId 
    ? (products?.filter((p: any) => scProductIds?.includes(p.id)) || [])
    : products;
  
  const productId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.productId` });
  const binId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.binId` });
  const dispatchQty = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.quantity` });
  
  const { data: balances = [] } = useQuery({
    queryKey: ['balances', productId],
    queryFn: async () => unwrapList(await api.get<any[]>(`/api/inventory/balances?productId=${productId}`)),
    enabled: !!productId
  });

  useEffect(() => {
    // Reset bin when product changes
    setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
    setValue(`scBlocks.${blockIndex}.items.${index}.quantity`, 0);
  }, [productId, setValue, blockIndex, index]);

  const selectedBalance = balances.find(b => b.binId === binId);
  const availableQty = selectedBalance ? selectedBalance.currentQuantity : 0;
  
  // Dynamic UOM based on product
  const product = products?.find(p => p.id === productId);
  const uom = product?.uom || 'NOS';
  
  const isQtyInvalid = dispatchQty > availableQty || dispatchQty <= 0;

  return (
    <tr className="h-14">
      <td className="px-3 py-2">
        <select
          {...register(`scBlocks.${blockIndex}.items.${index}.productId` as const, { required: 'Required' })}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
        >
          <option value="">Select Product...</option>
          {availableProducts?.map((p: any) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
        </select>
      </td>
      <td className="px-3 py-2">
        <select
          {...register(`scBlocks.${blockIndex}.items.${index}.binId` as const, { required: 'Required' })}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          disabled={!productId || balances.length === 0}
        >
          <option value="">Select Bin...</option>
          {balances.map(b => (
            <option key={b.binId} value={b.binId}>{b.binCode} ({b.currentQuantity} {uom})</option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const, { required: 'Required' })}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="e.g. HT-992"
        />
      </td>
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.description` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="Optional notes..."
        />
      </td>
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col">
          <input
            type="number"
            step="0.1"
            {...register(`scBlocks.${blockIndex}.items.${index}.quantity` as const, { 
              required: 'Required',
              validate: v => (v > 0 && v <= availableQty) || 'Invalid Quantity'
            })}
            className={`w-full h-8 px-2 rounded-md bg-white border text-xs text-slate-900 text-right tabular-nums focus:outline-none focus:ring-1 focus:border-transparent ${isQtyInvalid && binId ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'}`}
          />
          {binId && (
            <span className={`text-[9px] font-medium mt-0.5 ${isQtyInvalid ? 'text-red-500' : 'text-slate-500'}`}>
              Avail: {availableQty} {uom}
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => remove(index)}
          disabled={!canRemove}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
