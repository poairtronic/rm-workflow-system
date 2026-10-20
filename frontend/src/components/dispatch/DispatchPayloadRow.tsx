import { useEffect, useMemo } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Trash2, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';
import { SearchSelect, type SearchSelectOption } from '../ui/SearchSelect';

export function DispatchPayloadRow({
  blockIndex,
  index,
  remove,
  canRemove,
  isType1,
  baseSeq = 1,
}: {
  blockIndex: number;
  index: number;
  remove: (i: number) => void;
  canRemove: boolean;
  isType1?: boolean;
  baseSeq?: number;
}) {
  const { register, setValue, watch, control, formState: { errors } } = useFormContext();

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

  const productOptions: SearchSelectOption[] = useMemo(() => {
    return (sortedProducts as any[]).map((p: any) => {
      const scItem = selectedSc?.rmRequest?.items?.find(
        (i: any) =>
          (i.mappedProductId || i.mapped_product_id || i.productId || i.product_id) === p.id
      );
      const pNumVal = scItem?.partNumber || scItem?.part_number;
      const pNameVal = scItem?.partName || scItem?.part_name;

      const secondaryParts: string[] = [];
      if (p.family?.name) secondaryParts.push(p.family.name);
      if (p.uom) secondaryParts.push(p.uom);
      if (p.barcode) secondaryParts.push(`Barcode: ${p.barcode}`);
      if (pNumVal || pNameVal) secondaryParts.push(`SC Part: ${pNumVal || ''} ${pNameVal || ''}`.trim());

      const displayName = p.code ? `[${p.code}] ${p.name}` : p.name;

      return {
        id: p.id,
        primary: displayName,
        secondary: secondaryParts.join(' • '),
      };
    });
  }, [sortedProducts, selectedSc]);

  const outputProductOptions: SearchSelectOption[] = useMemo(() => {
    const all = ((products as any[]) || []).slice().sort((a, b) => {
      return (a.code || a.name || '').localeCompare(b.code || b.name || '', undefined, {
        numeric: true,
      });
    });

    return all.map((p: any) => {
      const secondaryParts: string[] = [];
      if (p.family?.name) secondaryParts.push(p.family.name);
      if (p.uom) secondaryParts.push(p.uom);
      if (p.barcode) secondaryParts.push(`Barcode: ${p.barcode}`);

      const displayName = p.code ? `[${p.code}] ${p.name}` : p.name;

      return {
        id: p.id,
        primary: displayName,
        secondary: secondaryParts.join(' • '),
      };
    });
  }, [products]);

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
      const pNum = foundItem.partNumber || foundItem.part_number || selectedSc?.scNumber || '';
      const pName = foundItem.partName || foundItem.part_name || foundItem.material || '';
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, pNum, { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.partName`, pName, { shouldValidate: true });
      setValue(`scBlocks.${blockIndex}.items.${index}.productId`, foundItem.mappedProductId || foundItem.mapped_product_id || '', { shouldValidate: true });
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
      } else if (scItemId === 'sc_assembly') {
        const expectedPartNo = selectedSc.scNumber || '';
        const expectedPartName = selectedSc.productName || '';
        setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, expectedPartNo, { shouldValidate: true });
        setValue(`scBlocks.${blockIndex}.items.${index}.partName`, expectedPartName, { shouldValidate: true });
        setValue(`scBlocks.${blockIndex}.items.${index}.productId`, '', { shouldValidate: true });
      } else {
        const found = scRmItems.find((it: any) => it.id === scItemId);
        if (found) {
          const pNum = found.partNumber || found.part_number || selectedSc?.scNumber || '';
          const pName = found.partName || found.part_name || found.material || '';
          const pId = found.mappedProductId || found.mapped_product_id || '';
          setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, pNum, { shouldValidate: true });
          setValue(`scBlocks.${blockIndex}.items.${index}.partName`, pName, { shouldValidate: true });
          setValue(`scBlocks.${blockIndex}.items.${index}.productId`, pId, { shouldValidate: true });
        }
      }
      return;
    }

    if (!isType1) {
      const currentSeq = (baseSeq || 1) + index;
      const defaultPartNo = `DC2-${String(currentSeq).padStart(3, '0')}`;
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, defaultPartNo, { shouldValidate: true });
      return;
    }

    if (currentScItem) {
      const pNum = currentScItem.partNumber || currentScItem.part_number || '';
      const pName = currentScItem.partName || currentScItem.part_name || currentScItem.material || '';
      setValue(`scBlocks.${blockIndex}.items.${index}.partNumber`, pNum);
      setValue(`scBlocks.${blockIndex}.items.${index}.partName`, pName);
    }
  }, [isType1, selectedSc, scRmItems, scItemId, currentScItem, setValue, blockIndex, index, baseSeq]);

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

  const currentSeq = (baseSeq || 1) + index;
  const defaultPartNo = `DC2-${String(currentSeq).padStart(3, '0')}`;

  const watchedPartNumber = watch(`scBlocks.${blockIndex}.items.${index}.partNumber`);
  const watchedPartName = watch(`scBlocks.${blockIndex}.items.${index}.partName`);
  const activeScItem = isType1 && scItemId && scItemId !== 'sc_assembly'
    ? scRmItems.find((it: any) => it.id === scItemId)
    : null;
  const partNumberVal =
    watchedPartNumber ||
    (activeScItem?.partNumber || activeScItem?.part_number) ||
    (!isType1 ? defaultPartNo : (scItemId === 'sc_assembly' ? selectedSc?.scNumber || '' : ''));

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 shadow-xs space-y-3.5 sm:space-y-4 hover:border-slate-300 transition-all">
      {/* Item Header Bar: S.No., Badge, and Action */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-slate-900 text-white shadow-2xs">
            S.No. {String(index + 1).padStart(2, '0')}
          </span>

          {partNumberVal && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs truncate max-w-[150px] sm:max-w-none">
              Part No: {partNumberVal}
            </span>
          )}

          <span className="hidden sm:inline text-xs text-slate-500 font-medium">
            {isType1 ? 'Production Process Component' : 'Stock Conversion Item'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => remove(index)}
          disabled={!canRemove}
          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-600 sm:text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          title="Remove this item"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove</span>
        </button>
      </div>

      {isType1 ? (
        /* ================= TYPE 1: PRODUCTION PROCESS (MULTI-LINE) ================= */
        <div className="space-y-3 sm:space-y-3.5">
          {/* Line 1: Part Selection, Auto Part No., & Quantity (Single column on mobile, gap: 12px) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-start">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                SC Item / Component Part Name *
              </label>
              {!selectedSc ? (
                <div className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-base sm:text-xs text-slate-400 flex items-center font-medium">
                  Select SC Code first...
                </div>
              ) : (
                <select
                  value={scItemId || ''}
                  onChange={(e) => handleType1ItemSelect(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium cursor-pointer"
                >
                  {scRmItems.length > 0 && (
                    <optgroup label={`SC Products / Materials (${scRmItems.length})`}>
                      {scRmItems.map((it: any) => {
                        const pNum = it.partNumber || it.part_number;
                        const pName = it.partName || it.part_name;
                        const labelParts = [
                          pNum ? `[${pNum}]` : '',
                          pName ? `${pName} —` : '',
                          it.material || 'Material',
                          it.grade ? `(${it.grade})` : '',
                          `• Qty: ${Number(it.quantity)}`,
                        ].filter(Boolean).join(' ');

                        return (
                          <option key={it.id} value={it.id}>
                            {labelParts}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                  <optgroup label="Component Assembly">
                    <option value="sc_assembly">
                      ★ [Assembly] {selectedSc.scNumber} - {selectedSc.productName} (Target: {Number(selectedSc.targetQuantity || 1)})
                    </option>
                  </optgroup>
                </select>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Part No. (Auto)
              </label>
              <input
                type="text"
                readOnly
                value={partNumberVal || '—'}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-base sm:text-xs font-mono font-bold text-blue-700 text-center select-none cursor-default shadow-2xs"
                title="Auto-assigned part number from RM Requisition"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Dispatched Quantity *
              </label>
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
                    return (!isNaN(num) && num > 0) || 'Quantity must be > 0';
                  },
                })}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Selected Item Detail Card */}
          {selectedSc && scItemId && (() => {
            if (scItemId === 'sc_assembly') {
              return (
                <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-[11px] text-indigo-950">
                  <span className="font-mono font-bold bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded text-[10px]">
                    SC: {selectedSc.scNumber}
                  </span>
                  <span className="font-semibold text-indigo-900">{selectedSc.productName}</span>
                  <span className="text-indigo-300">•</span>
                  <span>Target Assembly Qty: <strong>{Number(selectedSc.targetQuantity || 1)}</strong></span>
                </div>
              );
            }
            const activeIt = scRmItems.find((it: any) => it.id === scItemId);
            if (!activeIt) return null;
            const pNum = activeIt.partNumber || activeIt.part_number;
            const pName = activeIt.partName || activeIt.part_name;
            return (
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-[11px] text-blue-950">
                {pNum && (
                  <span className="font-mono font-bold bg-blue-200/70 text-blue-800 px-2 py-0.5 rounded text-[10px]">
                    {pNum}
                  </span>
                )}
                {pName && (
                  <span className="font-semibold text-slate-800">
                    {pName}
                  </span>
                )}
                {activeIt.material && (
                  <>
                    <span className="text-blue-300">•</span>
                    <span className="text-slate-700">Material: <strong className="font-medium text-slate-900">{activeIt.material}</strong></span>
                  </>
                )}
                {activeIt.grade && (
                  <>
                    <span className="text-blue-300">•</span>
                    <span className="text-slate-700">Grade: <strong className="font-medium text-slate-900">{activeIt.grade}</strong></span>
                  </>
                )}
                {activeIt.size && (
                  <>
                    <span className="text-blue-300">•</span>
                    <span className="text-slate-700">Size: <strong className="font-medium text-slate-900">{activeIt.size}</strong></span>
                  </>
                )}
                <span className="text-blue-300">•</span>
                <span className="text-slate-700">Requisition Qty: <strong className="font-medium text-slate-900">{Number(activeIt.quantity)}</strong></span>
              </div>
            );
          })()}

          <input type="hidden" value={scItemId || ''} {...register(`scBlocks.${blockIndex}.items.${index}.scItemId` as const)} />
          <input type="hidden" value={watchedPartNumber || ''} {...register(`scBlocks.${blockIndex}.items.${index}.partNumber` as const)} />
          <input type="hidden" value={watchedPartName || ''} {...register(`scBlocks.${blockIndex}.items.${index}.partName` as const)} />
          <input type="hidden" value={productId || ''} {...register(`scBlocks.${blockIndex}.items.${index}.productId` as const)} />

          {/* Line 2: Batch & Description (Entered in next line) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-start pt-2 border-t border-slate-100">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Batch / Heat No. (Optional)
              </label>
              <input
                {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const)}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
                placeholder="e.g. HT-992"
              />
            </div>

            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Description / Line Item Notes (Printed under this item on DC)
              </label>
              <input
                {...register(`scBlocks.${blockIndex}.items.${index}.description` as const)}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
                placeholder="Specific instructions or description printed directly below this line item..."
              />
            </div>
          </div>
        </div>
      ) : (
        /* ================= TYPE 2: STOCK CONVERSION (MULTI-LINE) ================= */
        <div className="space-y-3 sm:space-y-4">
          {/* Line 1: Outward RM Material & Custom Vendor Identity (Single column on mobile, gap: 12px) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-start">
            {/* 1a. Internal RM Stock (Searchable Dropdown) */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Internal RM Stock (Search) *
              </label>
              <Controller
                name={`scBlocks.${blockIndex}.items.${index}.productId` as const}
                control={control}
                rules={{ required: 'Product is required' }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    value={field.value || ''}
                    onChange={(val) => {
                      field.onChange(val);
                      setValue(`scBlocks.${blockIndex}.items.${index}.binId`, '');
                      const sel = products?.find((p: any) => p.id === val);
                      if (sel) {
                        const currentPartName = watch(`scBlocks.${blockIndex}.items.${index}.partName`);
                        if (!currentPartName) {
                          setValue(`scBlocks.${blockIndex}.items.${index}.partName`, sel.name, { shouldValidate: true });
                        }
                      }
                    }}
                    placeholder="Search product by name, code, barcode..."
                    searchPlaceholder="Type product name, code, or barcode..."
                    options={productOptions}
                    error={Boolean(fieldState.error)}
                    triggerClassName="min-h-[44px] sm:min-h-0 h-11 sm:h-9 text-base sm:text-xs"
                  />
                )}
              />
              {(errors as any)?.scBlocks?.[blockIndex]?.items?.[index]?.productId && (
                <p className="mt-1 text-[11px] text-red-500 font-medium">
                  {(errors as any).scBlocks[blockIndex].items[index].productId.message as string}
                </p>
              )}
            </div>

            {/* 1b. Auto Part No. */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Part No. (Auto)
              </label>
              <input
                type="text"
                readOnly
                value={partNumberVal}
                {...register(`scBlocks.${blockIndex}.items.${index}.partNumber` as const)}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-2.5 rounded-lg bg-slate-100 border border-slate-200 text-base sm:text-xs font-mono font-bold text-blue-700 text-center select-none cursor-default shadow-2xs"
                title="Auto-generated DC Part Number printed for Vendor"
              />
            </div>

            {/* 1c. DC Material Name (Vendor) */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                DC Material Name (For Vendor) *
              </label>
              <input
                type="text"
                placeholder="e.g. Aluminium Housing"
                {...register(`scBlocks.${blockIndex}.items.${index}.partName` as const, {
                  required: !isType1 ? 'DC Material Name is required' : false,
                })}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
                title="Material name printed on the Delivery Challan for vendor"
              />
            </div>

            {/* 1d. Dispatched Qty */}
            <div className="md:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Dispatched Qty *
                </label>
                {productId && (
                  <span
                    className={`text-[10px] font-bold ${
                      availableQty > 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    Avail: {availableQty} {uom}
                  </span>
                )}
              </div>
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
                  onChange: (e) => {
                    const val = e.target.value;
                    const currentExpected = watch(`scBlocks.${blockIndex}.items.${index}.expectedOutputQuantity`);
                    if (!currentExpected || currentExpected === '' || Number(currentExpected) === 0) {
                      setValue(`scBlocks.${blockIndex}.items.${index}.expectedOutputQuantity`, val ? Number(val) : ('' as any), { shouldValidate: true });
                    }
                  },
                })}
                className={`w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border text-base sm:text-xs text-slate-900 font-semibold tabular-nums focus:outline-none focus:ring-1 focus:border-transparent ${
                  isQtyInvalid && binId
                    ? 'border-rose-300 focus:ring-rose-500'
                    : 'border-slate-200 focus:ring-primary'
                }`}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Line 2: Warehouse Bin Location & Converted Return Product */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-start bg-slate-50/80 p-3 sm:p-3.5 rounded-xl border border-slate-200/80">
            {/* 2a. Source Rack */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Source Rack
              </label>
              <select
                value={selectedRackId || ''}
                onChange={(e) => handleRackChange(e.target.value)}
                disabled={!productId}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
              >
                <option value="">{selectedRackName ? selectedRackName : '— Select Rack —'}</option>
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
            </div>

            {/* 2b. Source Bin */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                Source Bin *
              </label>
              <select
                value={binId || ''}
                onChange={(e) => handleBinChange(e.target.value)}
                disabled={!productId}
                className={`w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:border-transparent font-medium ${
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
            </div>

            {/* 2c. Converted Output Material (Searchable Dropdown) */}
            <div className="md:col-span-4">
              <div className="flex items-center gap-1 mb-1.5">
                <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                  Converted Output Material (In) *
                </label>
              </div>
              <Controller
                name={`scBlocks.${blockIndex}.items.${index}.outputProductId` as const}
                control={control}
                rules={{ required: !isType1 ? 'Output product is required' : false }}
                render={({ field, fieldState }) => (
                  <SearchSelect
                    value={field.value || ''}
                    onChange={(val) => field.onChange(val)}
                    placeholder="Search converted output material..."
                    searchPlaceholder="Type output material name, code, barcode..."
                    options={outputProductOptions}
                    error={Boolean(fieldState.error)}
                    triggerClassName="min-h-[44px] sm:min-h-0 h-11 sm:h-9 text-base sm:text-xs border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100"
                  />
                )}
              />
              {(errors as any)?.scBlocks?.[blockIndex]?.items?.[index]?.outputProductId && (
                <p className="mt-1 text-[11px] text-red-500 font-medium">
                  {(errors as any).scBlocks[blockIndex].items[index].outputProductId.message as string}
                </p>
              )}
            </div>

            {/* 2d. Expected Inward Qty */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">
                Expected Inward Qty *
              </label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                placeholder="0.00"
                {...register(`scBlocks.${blockIndex}.items.${index}.expectedOutputQuantity` as const, {
                  required: !isType1 ? 'Expected output qty is required' : false,
                  valueAsNumber: true,
                  validate: (v) => {
                    if (isType1) return true;
                    const num = Number(v);
                    return (!isNaN(num) && num > 0) || 'Expected qty must be > 0';
                  },
                })}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-emerald-300 text-base sm:text-xs text-slate-900 text-right font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Line 3: Tracking & Notes (Entered in next line) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5 items-start pt-1">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Batch / Heat No. (Optional)
              </label>
              <input
                {...register(`scBlocks.${blockIndex}.items.${index}.batchNumber` as const)}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
                placeholder="e.g. HT-992"
              />
            </div>

            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Description / Line Item Notes (Printed under this item on DC)
              </label>
              <input
                {...register(`scBlocks.${blockIndex}.items.${index}.description` as const)}
                className="w-full min-h-[44px] sm:min-h-0 h-11 sm:h-9 px-3 rounded-lg bg-white border border-slate-200 text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent font-medium"
                placeholder="Specific instructions or description printed directly below this line item..."
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
