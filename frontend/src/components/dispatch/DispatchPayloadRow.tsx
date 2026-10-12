import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export function DispatchPayloadRow({
  blockIndex,
  index,
  remove,
  canRemove,
  isType1,
}: {
  blockIndex: number;
  index: number;
  remove: (i: number) => void;
  canRemove: boolean;
  isType1?: boolean;
}) {
  const { register, setValue, watch } = useFormContext();

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

  const scBlocks = watch('scBlocks');
  const scId = scBlocks?.[blockIndex]?.scId;
  const { data: scList } = useQuery({
    queryKey: ['sc'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/sc')),
  });
  const selectedSc = scList?.find((sc: any) => sc.id === scId);

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

  const productId = watch(`scBlocks.${blockIndex}.items.${index}.productId`);
  const binId = watch(`scBlocks.${blockIndex}.items.${index}.binId`);
  const dispatchQty = watch(`scBlocks.${blockIndex}.items.${index}.quantity`);

  // Query real stock balances for selected product
  const { data: balances = [] } = useQuery({
    queryKey: ['balances', productId],
    queryFn: async () =>
      unwrapList(await api.get<any[]>(`/api/inventory/balances?productId=${productId}`)),
    enabled: !!productId && !isType1,
  });

  // Filter positive stock balances
  const positiveBalances = useMemo(() => {
    return balances.filter((b: any) => Number(b.currentQuantity) > 0);
  }, [balances]);

  // Product and dynamic UOM
  const product = products?.find((p: any) => p.id === productId);
  const uom = product?.uom?.toUpperCase() || (isType1 ? 'NOS' : 'NOS');

  // Auto-select correct bin with positive stock when product or balances change
  useEffect(() => {
    if (isType1) {
      return;
    }

    if (!productId) {
      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
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
  }, [isType1, productId, positiveBalances, binId, setValue, blockIndex, index, uom]);

  // Find matching SC item to get Part Number and Part Name
  const currentScItem = useMemo(() => {
    if (!productId || !selectedSc?.rmRequest?.items) return null;
    return selectedSc.rmRequest.items.find(
      (i: any) =>
        (i.mappedProductId || i.mapped_product_id || i.productId || i.product_id) === productId
    );
  }, [productId, selectedSc]);

  const scRmItems = useMemo(() => {
    return (selectedSc?.rmRequest?.items as any[]) || [];
  }, [selectedSc]);

  const scItemId = watch(`scBlocks.${blockIndex}.items.${index}.scItemId`);

  const handleType1ItemSelect = (selectedKey: string) => {
    setValue(`scBlocks.${blockIndex}.items.${index}.scItemId`, selectedKey, { shouldValidate: true });
    if (selectedKey === 'sc_assembly') {
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, selectedSc?.scNumber || '', { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.partName`, selectedSc?.productName || '', { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.productId`, '', { shouldValidate: true });
      if (selectedSc?.targetQuantity) {
        setValue(`scBlocks.${blockIndex}.items.${index}.quantity`, Number(selectedSc.targetQuantity), { shouldValidate: true });
      }
      return;
    }

    const foundItem = scRmItems.find((it: any) => it.id === selectedKey);
    if (foundItem) {
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, foundItem.partNumber || selectedSc?.scNumber || '', { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.partName`, foundItem.partName || foundItem.material || '', { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.productId`, foundItem.mappedProductId || '', { shouldValidate: true });
      if (foundItem.quantity) {
        setValue(`scBlocks.${blockIndex}.items.${index}.quantity`, Number(foundItem.quantity), { shouldValidate: true });
      }
    }
  };

  // Sync partNumber and partName into form state
  useEffect(() => {
    if (isType1) {
      if (!selectedSc) {
        setValue(`scBlocks.${blockIndex}.items.${index}.scItemId`, '');
        setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, '');
        setValue(`scBlocks.${blockIndex}.items.${index}.partName`, '');
        setValue(`scBlocks.${blockIndex}.items.${index}.productId`, '');
        return;
      }

      const isValidKey = scItemId === 'sc_assembly' || scRmItems.some((it: any) => it.id === scItemId);
      if (!scItemId || !isValidKey) {
        if (scRmItems.length > 0) {
          const itemToSelect = scRmItems[index] || scRmItems[0];
          handleType1ItemSelect(itemToSelect.id);
        } else {
          handleType1ItemSelect('sc_assembly');
        }
      }
      return;
    }

    if (!isType1) {
      const defaultPartNo = `DC2-${String(index + 1).padStart(3, '0')}`;
      const existingPartNo = watch(`scBlocks.${blockIndex}.items.${index}.partNumber`);
      if (!existingPartNo) {
        setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, defaultPartNo, { shouldValidate: true });
      }
      return;
    }

    if (currentScItem) {
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, currentScItem.partNumber || '');
      setValue(`scBlocks.${blockIndex}.items.${index}.partName`, currentScItem.partName || currentScItem.material || '');
    }
  }, [isType1, selectedSc, scRmItems, scItemId, currentScItem, setValue, blockIndex, index]);

  const getProductDisplayLabel = (p: any) => {
    const scItem = selectedSc?.rmRequest?.items?.find(
      (i: any) =>
        (i.mappedProductId || i.mapped_product_id || i.productId || i.product_id) === p.id
    );
    if (scItem && (scItem.partNumber || scItem.partName)) {
      const pNum = scItem.partNumber ? `[${scItem.partNumber}] ` : '';
      const pName = scItem.partName ? `${scItem.partName} - ` : '';
      return `${pNum}${pName}${p.code ? `[${p.code}] ` : ''}${p.name}`;
    }
    return `${p.code ? `[${p.code}] ` : ''}${p.name}`;
  };

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
    !isType1 && productId && (dispatchQty > availableQty || dispatchQty <= 0 || availableQty === 0);

  return (
    <tr className="h-14">
      {/* 1. Material / Part Name */}
      <td className="px-3 py-2">
        {isType1 ? (
          <div>
            {!selectedSc ? (
              <div className="w-full h-8 px-2 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-400 flex items-center font-medium">
                Select SC Code first...
              </div>
            ) : (
              <select
                value={scItemId || ''}
                onChange={(e) => handleType1ItemSelect(e.target.value)}
                className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium cursor-pointer"
              >
                {scRmItems.length > 0 && (
                  <optgroup label={`SC Products / Materials (${scRmItems.length})`}>
                    {scRmItems.map((it: any) => (
                      <option key={it.id} value={it.id}>
                        {it.material || it.partName || 'Item'} {it.grade ? `(${it.grade})` : ''} • Qty: {Number(it.quantity)}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Component Assembly">
                  <option value="sc_assembly">
                    ★ {selectedSc.scNumber} - {selectedSc.productName} (Target: {Number(selectedSc.targetQuantity || 1)})
                  </option>
                </optgroup>
              </select>
            )}
            {selectedSc && scItemId && scItemId !== 'sc_assembly' && (() => {
              const activeIt = scRmItems.find((it: any) => it.id === scItemId);
              if (!activeIt) return null;
              return (
                <div className="flex items-center gap-1.5 mt-1 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-[10px] text-blue-900">
                  <span className="font-semibold">{activeIt.materialType || 'MATERIAL'}</span>
                  {activeIt.grade && (
                    <>
                      <span>•</span>
                      <span>Grade: {activeIt.grade}</span>
                    </>
                  )}
                  {activeIt.size && (
                    <>
                      <span>•</span>
                      <span>Size: {activeIt.size}</span>
                    </>
                  )}
                </div>
              );
            })()}
            <input type="hidden" {...register(`scBlocks.${blockIndex}.items.${index}.scItemId` as const)} />
            <input type="hidden" {...register(`scBlocks.${blockIndex}.items.${index}.partNumber` as const)} />
            <input type="hidden" {...register(`scBlocks.${blockIndex}.items.${index}.partName` as const)} />
          </div>
        ) : (
          <select
            {...register(`scBlocks.${blockIndex}.items.${index}.productId` as const, {
              required: 'Product is required',
            })}
            className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
          >
            <option value="">Select Internal RM...</option>
            {sortedProducts.map((p: any) => (
              <option key={p.id} value={p.id}>
                {getProductDisplayLabel(p)}
              </option>
            ))}
          </select>
        )}
      </td>

      {/* 1b. Type 2 Auto-Generated DC Part Number */}
      {!isType1 && (
        <td className="px-3 py-2 text-center">
          <input
            type="text"
            readOnly
            value={watch(`scBlocks.${blockIndex}.items.${index}.partNumber`) || `DC2-${String(index + 1).padStart(3, '0')}`}
            {...register(`scBlocks.${blockIndex}.items.${index}.partNumber` as const)}
            className="w-24 h-8 px-2 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-blue-700 text-center select-none cursor-default shadow-xs"
            title="Auto-generated DC Part Number printed for Vendor"
          />
        </td>
      )}

      {/* 1c. Type 2 Custom DC Material Name for Vendor */}
      {!isType1 && (
        <td className="px-3 py-2">
          <input
            type="text"
            placeholder="e.g. Aluminium Housing"
            {...register(`scBlocks.${blockIndex}.items.${index}.partName` as const, {
              required: !isType1 ? 'DC Material Name is required' : false,
            })}
            className="w-44 h-8 px-2.5 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium shadow-xs"
            title="Material name printed on the Delivery Challan for vendor"
          />
        </td>
      )}

      {/* 2. Rack (Dedicated distinct field) */}
      {!isType1 && (
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
      )}

      {/* 3. Bin (Dedicated distinct field) */}
      {!isType1 && (
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
            required: !isType1 ? 'Bin is required' : false,
          })}
        />
      </td>
      )}

      {/* 4. Quantity & Available Balance (Input / Dispatched) */}
      <td className="px-3 py-2 text-right">
        <div className="flex flex-col">
          <input
            type="number"
            step="0.001"
            min="0.001"
            onFocus={(e) => e.target.select()}
            {...register(`scBlocks.${blockIndex}.items.${index}.quantity` as const, {
              required: 'Quantity is required',
              valueAsNumber: true,
              validate: (v) => {
                const num = Number(v);
                if (isNaN(num) || num <= 0) return 'Quantity must be > 0';
                if (!isType1 && num > availableQty) return `Exceeds available stock (${availableQty})`;
                return true;
              },
            })}
            className={`w-full h-8 px-2 rounded-md bg-white border text-xs text-slate-900 text-right tabular-nums focus:outline-none focus:ring-1 focus:border-transparent ${
              isQtyInvalid && binId && !isType1
                ? 'border-red-300 focus:ring-red-500'
                : 'border-slate-200 focus:ring-primary'
            }`}
          />
          {productId && !isType1 && (
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

      {/* 5. Converted Output Product (Type 2 Stock Conversion) */}
      {!isType1 && (
        <td className="px-3 py-2">
          <select
            {...register(`scBlocks.${blockIndex}.items.${index}.outputProductId` as const, {
              required: !isType1 ? 'Output product is required' : false,
            })}
            className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
          >
            <option value="">Select Converted Output Product...</option>
            {sortedProducts.map((p: any) => (
              <option key={p.id} value={p.id}>
                {getProductDisplayLabel(p)}
              </option>
            ))}
          </select>
        </td>
      )}

      {/* 6. Expected Output Quantity (Type 2 Stock Conversion) */}
      {!isType1 && (
        <td className="px-3 py-2 text-right">
          <input
            type="number"
            step="0.001"
            min="0.001"
            placeholder="Expected qty..."
            {...register(`scBlocks.${blockIndex}.items.${index}.expectedOutputQuantity` as const, {
              required: !isType1 ? 'Expected output qty is required' : false,
              valueAsNumber: true,
              validate: (v) => {
                if (isType1) return true;
                const num = Number(v);
                return (!isNaN(num) && num > 0) || 'Expected qty must be > 0';
              },
            })}
            className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
          />
        </td>
      )}

      {/* 7. Batch / Heat No */}
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="e.g. HT-992 (Optional)"
        />
      </td>

      {/* 8. Description */}
      <td className="px-3 py-2">
        <input
          {...register(`scBlocks.${blockIndex}.items.${index}.description` as const)}
          className="w-full h-8 px-2 rounded-md bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          placeholder="Optional notes..."
        />
      </td>

      {/* 9. Action */}
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
