import { useEffect, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export function DispatchPayloadRow({
  blockIndex,
  index,
  remove,
  canRemove,
}: {
  blockIndex: number;
  index: number;
  remove: (i: number) => void;
  canRemove: boolean;
}) {
  const { register, control, setValue } = useFormContext();

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/products?pageSize=1000')),
  });

  // All warehouse racks
  const { data: allRacks = [] } = useQuery({
    queryKey: ['all-racks-master'],
    queryFn: async () => {
      const res = await masterDataService.getRacks({ pageSize: 1000, isActive: true });
      return res.data || [];
    },
    staleTime: 60000,
  });

  // All warehouse bins
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
    enabled: !!scId,
  });

  const scProductIds =
    selectedSc?.rmRequest?.items
      ?.map(
        (i: any) =>
          i.mappedProductId ||
          i.mapped_product_id ||
          i.productId ||
          i.product_id ||
          i.mappedProduct?.id ||
          i.product?.id,
      )
      .filter(Boolean) || [];

  const availableProducts =
    scId && scProductIds.length > 0
      ? products?.filter((p: any) => scProductIds.includes(p.id)) || []
      : products || [];

  const sortedProducts = useMemo(() => {
    return (availableProducts as any[]).slice().sort((a, b) => {
      return (a.code || a.name || '').localeCompare(b.code || b.name || '', undefined, {
        numeric: true,
      });
    });
  }, [availableProducts]);

  const productId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.productId` });
  const binId = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.binId` });
  const dispatchQty = useWatch({ control, name: `scBlocks.${blockIndex}.items.${index}.quantity` });

  // Query real stock balances for selected product
  const { data: balances = [] } = useQuery({
    queryKey: ['balances', productId],
    queryFn: async () =>
      unwrapList(await api.get<any[]>(`/api/inventory/balances?productId=${productId}`)),
    enabled: !!productId,
  });

  // Filter positive stock balances
  const positiveBalances = useMemo(() => {
    return balances.filter((b: any) => Number(b.currentQuantity) > 0);
  }, [balances]);

  // Product and dynamic UOM
  const product = products?.find((p: any) => p.id === productId);
  const uom = product?.uom?.toUpperCase() || 'NOS';

  // Auto-select correct bin with positive stock when product or balances change
  useEffect(() => {
    if (!productId) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
      setValue(`scBlocks.${blockIndex}.items.${index}.quantity`, 0);
      return;
    }

    // Always update UOM
    setValue(`scBlocks.${blockIndex}.items.${index}.uom`, uom);

    if (positiveBalances.length > 0) {
      // Auto-select first bin with positive stock if current bin has none
      const currentBinHasPositive = positiveBalances.some((b: any) => b.binId === binId);
      if (!binId || !currentBinHasPositive) {
        setValue(`scBlocks.${blockIndex}.items.${index}.binId`, positiveBalances[0].binId);
      }
    } else {
      // No positive balance in any bin for this product - do NOT auto-assign random bin
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
    }
  }, [productId, positiveBalances, binId, setValue, blockIndex, index, uom]);

  // Find currently selected bin and its rack
  const selectedBin = allBins.find((ab: any) => ab.id === binId);
  const selectedRack =
    selectedBin?.rack || allRacks.find((r: any) => r.id === selectedBin?.rackId);
  const selectedRackId = selectedRack?.id;
  const selectedRackName = selectedRack?.name || selectedRack?.code || '';

  // Current available quantity in selected bin
  const selectedBalance = balances.find((b: any) => b.binId === binId);
  const availableQty = selectedBalance ? Number(selectedBalance.currentQuantity) : 0;

  // Racks that currently contain stock for this product
  const racksWithStock = useMemo(() => {
    const rackMap = new Map<string, any>();
    positiveBalances.forEach((b: any) => {
      const binObj = allBins.find((ab: any) => ab.id === b.binId);
      const rack = binObj?.rack || allRacks.find((r: any) => r.id === binObj?.rackId);
      if (rack && !rackMap.has(rack.id)) {
        rackMap.set(rack.id, rack);
      }
    });
    return Array.from(rackMap.values());
  }, [positiveBalances, allBins, allRacks]);

  // Bins without stock (for explicit override or browsing)
  const otherBins = useMemo(() => {
    const stockBinIds = new Set(positiveBalances.map((b: any) => b.binId));
    let pool = allBins.filter((ab: any) => !stockBinIds.has(ab.id));
    if (selectedRackId) {
      // If a rack is selected, prioritize bins from that rack
      const inRack = pool.filter((ab: any) => ab.rackId === selectedRackId);
      if (inRack.length > 0) pool = inRack;
    }
    return pool;
  }, [allBins, positiveBalances, selectedRackId]);

  // Handle explicit Rack change
  const handleRackChange = (targetRackId: string) => {
    if (!targetRackId) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
      return;
    }
    const binsInRack = allBins.filter((ab: any) => ab.rackId === targetRackId);
    // Prefer bin in this rack with positive stock
    const stockBin = positiveBalances.find((pb: any) =>
      binsInRack.some((b: any) => b.id === pb.binId),
    );
    if (stockBin) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, stockBin.binId);
    } else if (binsInRack.length > 0) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, binsInRack[0].id);
    } else {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
    }
  };

  // Handle explicit Bin change
  const handleBinChange = (targetBinId: string) => {
    setValue(`scBlocks.${blockIndex}.items.${index}.binId`, targetBinId);
  };

  const isQtyInvalid =
    productId && (dispatchQty > availableQty || dispatchQty <= 0 || availableQty === 0);

  return (
    <tr className="h-14">
      {/* 1. Material */}
      <td className="px-3 py-2">
        <select
          {...register(`scBlocks.${blockIndex}.items.${index}.productId` as const, {
            required: 'Product is required',
          })}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
        >
          <option value="">Select Product...</option>
          {sortedProducts.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
      </td>

      {/* 2. Rack (Dedicated distinct field) */}
      <td className="px-3 py-2">
        <select
          value={selectedRackId || ''}
          onChange={(e) => handleRackChange(e.target.value)}
          disabled={!productId}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
        >
          <option value="">{selectedRackName ? selectedRackName : '—'}</option>
          {racksWithStock.length > 0 && (
            <optgroup label="Racks with Available Stock">
              {racksWithStock.map((r: any) => (
                <option key={r.id} value={r.id}>
                  ★ {r.name || r.code}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="All Warehouse Racks">
            {allRacks.map((r: any) => (
              <option key={r.id} value={r.id}>
                {r.name || r.code}
              </option>
            ))}
          </optgroup>
        </select>
      </td>

      {/* 3. Bin (Dedicated distinct field) */}
      <td className="px-3 py-2">
        <select
          value={binId || ''}
          onChange={(e) => handleBinChange(e.target.value)}
          disabled={!productId}
          className={`w-full h-8 px-2 rounded-md bg-white border text-xs text-slate-900 focus:outline-none focus:ring-1 focus:border-transparent font-medium ${
            !binId && productId ? 'border-amber-300' : 'border-slate-200 focus:ring-primary'
          }`}
        >
          <option value="">
            {!productId
              ? 'Select product...'
              : positiveBalances.length === 0
              ? 'No bins with stock'
              : 'Select Bin...'}
          </option>
          {positiveBalances.length > 0 && (
            <optgroup label="Bins with Available Stock">
              {positiveBalances.map((b: any) => {
                const binObj = allBins.find((ab: any) => ab.id === b.binId);
                const rLabel = binObj?.rack?.name || binObj?.rack?.code;
                return (
                  <option key={b.binId} value={b.binId}>
                    {b.binCode} • Avail: {b.currentQuantity} {uom}
                    {rLabel ? ` (${rLabel})` : ''}
                  </option>
                );
              })}
            </optgroup>
          )}
          {otherBins.length > 0 && (
            <optgroup label="Other Warehouse Bins (0 Stock)">
              {otherBins.slice(0, 30).map((ab: any) => (
                <option key={ab.id} value={ab.id}>
                  {ab.code} • 0 {uom} ({ab.rack?.name || 'Rack'})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <input
          type="hidden"
          {...register(`scBlocks.${blockIndex}.items.${index}.binId` as const, {
            required: 'Bin is required',
          })}
        />
      </td>

      {/* 4. Batch / Heat No */}
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="e.g. HT-992 (Optional)"
        />
      </td>

      {/* 5. Description */}
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.description` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="Optional notes..."
        />
      </td>

      {/* 6. Quantity & Available Balance */}
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col">
          <input
            type="number"
            step="0.001"
            {...register(`scBlocks.${blockIndex}.items.${index}.quantity` as const, {
              required: 'Quantity is required',
              validate: (v) => {
                const num = Number(v);
                if (num <= 0) return 'Quantity must be > 0';
                if (num > availableQty) return `Exceeds available stock (${availableQty})`;
                return true;
              },
            })}
            className={`w-full h-8 px-2 rounded-md bg-white border text-xs text-slate-900 text-right tabular-nums focus:outline-none focus:ring-1 focus:border-transparent ${
              isQtyInvalid && binId
                ? 'border-red-300 focus:ring-red-500'
                : 'border-slate-200 focus:ring-primary'
            }`}
          />
          {productId && (
            <span
              className={`text-[10px] font-semibold mt-0.5 block ${
                availableQty > 0 ? 'text-slate-500' : 'text-red-500'
              }`}
            >
              Avail: {availableQty} {uom}
            </span>
          )}
        </div>
      </td>

      {/* 7. Action */}
      <td className="px-3 py-2 text-center">
        <button
          type="button"
          onClick={() => remove(index)}
          disabled={!canRemove}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Remove item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
}
