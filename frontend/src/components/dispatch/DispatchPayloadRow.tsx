import { useState, useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export function DispatchPayloadRow({ blockIndex, index, remove, canRemove }: { blockIndex: number, index: number, remove: (i: number) => void, canRemove: boolean }) {
  const { register, control, setValue } = useFormContext();
  
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => unwrapList(await api.get<any[]>('/api/products')) });
  
  // All system bins for fallback and custom rack selection
  const { data: allBins = [] } = useQuery({
    queryKey: ['all-bins-master'],
    queryFn: async () => {
      const res = await masterDataService.getBins({ pageSize: 1000, isActive: true });
      return res.data || [];
    },
    staleTime: 60000,
  });

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

  const scProductIds = selectedSc?.rmRequest?.items?.map((i: any) => i.mappedProductId || i.mapped_product_id || i.productId || i.product_id || i.mappedProduct?.id || i.product?.id).filter(Boolean) || [];
  const availableProducts = (scId && scProductIds.length > 0)
    ? (products?.filter((p: any) => scProductIds.includes(p.id)) || [])
    : products;
  
  const productId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.productId` });
  const binId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.binId` });
  const dispatchQty = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.quantity` });
  
  const { data: balances = [] } = useQuery({
    queryKey: ['balances', productId],
    queryFn: async () => unwrapList(await api.get<any[]>(`/api/inventory/balances?productId=${productId}`)),
    enabled: !!productId
  });

  // State for typable bin / rack input
  const [binInputText, setBinInputText] = useState('');

  // Auto-fill bin/rack when product and balances change
  useEffect(() => {
    if (!productId) {
      setBinInputText('');
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
      setValue(`scBlocks.${blockIndex}.items.${index}.quantity`, 0);
      return;
    }

    if (balances && balances.length > 0) {
      // Find the first bin with positive quantity, or first balance
      const best = balances.find((b: any) => Number(b.currentQuantity) > 0) || balances[0];
      if (best) {
        const binObj = allBins.find((ab: any) => ab.id === best.binId);
        const rackLabel = binObj?.rack?.name || binObj?.rack?.code || '';
        const display = rackLabel ? `${rackLabel} / ${best.binCode}` : best.binCode;
        setBinInputText(display);
        setValue(`scBlocks.${blockIndex}.items.${index}.binId`, best.binId);
      }
    } else if (allBins.length > 0 && !binId) {
      // Default to first warehouse bin if no balances exist
      const defaultBin = allBins[0];
      const rackLabel = defaultBin.rack?.name || defaultBin.rack?.code || '';
      const display = rackLabel ? `${rackLabel} / ${defaultBin.code}` : defaultBin.code;
      setBinInputText(display);
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, defaultBin.id);
    }
  }, [productId, balances, allBins, setValue, blockIndex, index]);

  // Synchronize text when binId is set externally
  useEffect(() => {
    if (binId && !binInputText) {
      const fromBal = balances.find((b: any) => b.binId === binId);
      if (fromBal) {
        const binObj = allBins.find((ab: any) => ab.id === binId);
        const rackLabel = binObj?.rack?.name || binObj?.rack?.code || '';
        setBinInputText(rackLabel ? `${rackLabel} / ${fromBal.binCode}` : fromBal.binCode);
      } else {
        const fromAll = allBins.find((ab: any) => ab.id === binId);
        if (fromAll) {
          const rackLabel = fromAll.rack?.name || fromAll.rack?.code || '';
          setBinInputText(rackLabel ? `${rackLabel} / ${fromAll.code}` : fromAll.code);
        }
      }
    }
  }, [binId, balances, allBins, binInputText]);

  // Handle user typing or picking another rack/bin
  const handleBinInputChange = (text: string) => {
    setBinInputText(text);
    const lower = text.trim().toLowerCase();
    if (!lower) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
      return;
    }

    // 1. Try to match from balances first
    const matchBal = balances.find((b: any) => {
      const bCode = (b.binCode || '').toLowerCase();
      const rName = (b.rackName || '').toLowerCase();
      return (
        bCode === lower ||
        rName === lower ||
        `${rName} / ${bCode}`.toLowerCase() === lower ||
        bCode.includes(lower) ||
        rName.includes(lower)
      );
    });
    if (matchBal) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, matchBal.binId);
      return;
    }

    // 2. Try to match from allBins
    const matchAll = allBins.find((ab: any) => {
      const bCode = (ab.code || '').toLowerCase();
      const bName = (ab.name || '').toLowerCase();
      const rName = (ab.rack?.name || '').toLowerCase();
      const rCode = (ab.rack?.code || '').toLowerCase();
      return (
        bCode === lower ||
        bName === lower ||
        rName === lower ||
        rCode === lower ||
        `${rName} / ${bCode}`.toLowerCase() === lower ||
        rName.includes(lower) ||
        rCode.includes(lower) ||
        bCode.includes(lower) ||
        bName.includes(lower)
      );
    });
    if (matchAll) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, matchAll.id);
    }
  };

  const selectedBalance = balances.find((b: any) => b.binId === binId);
  const availableQty = selectedBalance ? Number(selectedBalance.currentQuantity) : 0;
  
  // Dynamic UOM based on product
  const product = products?.find((p: any) => p.id === productId);
  const uom = product?.uom || 'NOS';
  
  const isQtyInvalid = dispatchQty > availableQty || dispatchQty <= 0;
  const datalistId = `bin-options-${blockIndex}-${index}`;

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
        <div className="relative">
          <input
            type="text"
            list={datalistId}
            value={binInputText}
            onChange={(e) => handleBinInputChange(e.target.value)}
            disabled={!productId}
            placeholder={!productId ? 'Select product first...' : 'Rack / Bin (e.g. Rack 3)...'}
            className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
          />
          <input
            type="hidden"
            {...register(`scBlocks.${blockIndex}.items.${index}.binId` as const, { required: 'Bin/Rack is required' })}
          />
          <datalist id={datalistId}>
            {balances.map((b: any) => {
              const binObj = allBins.find((ab: any) => ab.id === b.binId);
              const rackStr = binObj?.rack?.name || binObj?.rack?.code || '';
              return (
                <option
                  key={b.binId}
                  value={rackStr ? `${rackStr} / ${b.binCode}` : b.binCode}
                  label={`★ Stock: ${b.currentQuantity} ${uom}`}
                />
              );
            })}
            {allBins
              .filter((ab: any) => !balances.some((b: any) => b.binId === ab.id))
              .slice(0, 50)
              .map((ab: any) => {
                const rackStr = ab.rack?.name || ab.rack?.code || '';
                return (
                  <option
                    key={ab.id}
                    value={rackStr ? `${rackStr} / ${ab.code}` : ab.code}
                    label={ab.name || 'Warehouse Bin'}
                  />
                );
              })}
          </datalist>
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="e.g. HT-992 (Optional)"
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
