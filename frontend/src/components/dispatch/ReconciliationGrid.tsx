import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { FileDigit, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export function ReconciliationGrid({ dc, isReadOnly }: { dc: any; isReadOnly?: boolean }) {
  const { register, control, setValue } = useFormContext<any>();
  const { fields } = useFieldArray({ control, name: 'items' });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/products?pageSize=1000')),
  });

  const { data: allBins = [] } = useQuery({
    queryKey: ['all-bins-master'],
    queryFn: async () => {
      const res = await masterDataService.getBins({ pageSize: 1000, isActive: true });
      return res.data || [];
    },
    staleTime: 60000,
  });

  const isType1 = dc.type === 'PRODUCTION_PROCESS_OUTWARD';
  const isClosed = isReadOnly || dc.status === 'CLOSED' || dc.status === 'RETURNED';

  // Watch all items to compute real-time variances
  const formItems = useWatch({ control, name: 'items' }) || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 border-b border-slate-100 pb-4 gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <FileDigit className="w-5 h-5 text-primary" />
            Dock Inward & Return Verification Grid
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isClosed
              ? 'Finalized Delivery Challan: All lines are locked for administrative review.'
              : isType1
              ? 'Enter actual physical received quantity from vendor and forward directly to QC.'
              : 'Edit expected return quantity if vendor yield changed, enter actual physical received quantity, and forward directly to QC.'}
          </p>
        </div>
        {!isType1 ? (
          <div className="flex items-center gap-2 text-xs bg-blue-50/70 border border-blue-200 text-blue-900 px-3 py-1.5 rounded-lg">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Variation</strong> = Initial Expected − Revised Expected (Yield difference). It is distinct from <strong>Partial Balance</strong> remaining at vendor.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg">
            <Info className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              <strong>Type 1 Process DC</strong>: Return product is fixed to process target and expected quantity matches process dispatch.
            </span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Dispatched Item</th>
              <th className="px-4 py-3">Inward Return Product</th>
              {!isType1 && <th className="px-4 py-3">Destination Storage Bin</th>}
              {isType1 ? (
                <th className="px-4 py-3 text-right">Expected Qty</th>
              ) : (
                <>
                  <th className="px-4 py-3 text-right">Initial Expected</th>
                  <th className="px-4 py-3 text-right">Expected on Receipt (Editable)</th>
                  <th className="px-4 py-3 text-center">Expected Variation</th>
                </>
              )}
              <th className="px-4 py-3 text-right">Actual Received (to QC)</th>
              <th className="px-4 py-3 text-right">Remaining at Vendor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field, index) => {
              const originalItem =
                dc.items?.find((item: any) => item.id === (field as any).itemId) || dc.items?.[index];
              const dispProduct = products?.find((p: any) => p.id === originalItem?.productId);
              const retProductId = originalItem?.outputProductId || originalItem?.productId;
              const retProduct = products?.find((p: any) => p.id === retProductId);

              const dcNumber = dc.challanNumber || dc.dcNumber;
              const activeReworkAtVendor = (dc.reworkItems || [])
                .filter(
                  (r: any) =>
                    r.reworkStatus === 'RE_DISPATCHED' &&
                    (r.reworkDcNumber === dcNumber || r.sourceDcNumber === dcNumber) &&
                    (r.productId === originalItem?.productId || r.partNumber === (originalItem?.partNumber || dispProduct?.code)),
                )
                .reduce((sum: number, r: any) => sum + Number(r.rejectedQty || 0), 0);
              const settledRejected = Math.max(0, Number(originalItem?.qcRejectedQty || 0) - activeReworkAtVendor);
              const alreadyAccounted =
                Number(originalItem?.qcPendingQty || 0) +
                Number(originalItem?.qcPassedQty || 0) +
                settledRejected;

              // 1. Initial Expected Qty (from DC creation baseline)
              const initialExpectedQty = !isType1
                ? Number(originalItem?.initialExpectedQty ?? originalItem?.expectedOutputQuantity ?? originalItem?.quantityDispatched ?? 0)
                : Number(originalItem?.initialExpectedQty ?? originalItem?.quantityDispatched ?? 0);

              // 2. Revised Expected Qty on Receipt
              const formExpectedInput = formItems[index]?.expectedReturnQty;
              const revisedExpectedQty = isType1
                ? initialExpectedQty
                : formExpectedInput !== undefined && formExpectedInput !== null && !isNaN(Number(formExpectedInput)) && Number(formExpectedInput) > 0
                  ? Number(formExpectedInput)
                  : Number(originalItem?.expectedReturnQty ?? initialExpectedQty);

              // 3. Expected Variation (Initial - Revised)
              const expectedVariation = isType1 ? 0 : Math.max(0, initialExpectedQty - revisedExpectedQty);
              const hasVariation = expectedVariation > 0;

              // 4. Actual Received Qty
              const actualReceivedInput = formItems[index]?.receivedQuantity ?? formItems[index]?.actualReceivedQty;
              const actualReceivedQty =
                actualReceivedInput !== undefined && actualReceivedInput !== null && !isNaN(Number(actualReceivedInput))
                  ? Number(actualReceivedInput)
                  : Math.max(0, revisedExpectedQty - alreadyAccounted);

              // 5. Remaining / Partial Balance at Vendor (Revised Expected - Accounted - Received Now)
              const remainingTarget = Math.max(0, revisedExpectedQty - alreadyAccounted);
              const unreceivedBalanceAtVendor = Math.max(0, remainingTarget - actualReceivedQty);

              return (
                <tr key={field.id} className="h-16 hover:bg-[#F8FAFC]">
                  {/* Dispatched Product */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">
                      {originalItem?.partNumber || dispProduct?.code || originalItem?.product?.code || originalItem?.productId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {originalItem?.partName || dispProduct?.name || originalItem?.product?.name || 'Dispatched Item'}
                    </p>
                    <span className="inline-block text-[10px] text-slate-400 font-mono mt-0.5">
                      Disp: {Number(originalItem?.quantityDispatched || 0)} {dispProduct?.uom || 'NOS'}
                    </span>
                  </td>

                  {/* Return Converted Product (Read-Only) */}
                  <td className="px-4 py-3">
                    <input
                      type="hidden"
                      {...register(`items.${index}.returnedProductId` as const)}
                      value={originalItem?.outputProductId || originalItem?.productId || ''}
                    />
                    <div className="max-w-[220px]">
                      <p className="font-semibold text-slate-800 text-xs truncate" title={retProduct?.code || dispProduct?.code || originalItem?.partNumber || ''}>
                        {retProduct?.code || dispProduct?.code || originalItem?.partNumber || originalItem?.product?.code || '—'}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate" title={retProduct?.name || dispProduct?.name || originalItem?.partName || ''}>
                        {retProduct?.name || dispProduct?.name || originalItem?.partName || originalItem?.product?.name || (isType1 ? 'Same as Dispatched' : 'Converted Product')}
                      </p>
                    </div>
                  </td>

                  {/* Destination Storage Bin (Type 2 only) */}
                  {!isType1 && (
                    <td className="px-4 py-3">
                      {isClosed ? (
                        <span className="text-xs font-medium text-slate-700">
                          {allBins.find((b: any) => b.id === (originalItem?.outputBinId || originalItem?.returnTargetBinId || originalItem?.binId))?.code || '—'}
                        </span>
                      ) : (
                        <select
                          {...register(`items.${index}.destinationBinId` as const, {
                            required: !isType1 ? 'Destination bin is required' : false,
                          })}
                          className="w-40 h-9 px-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                        >
                          <option value="">Select Bin...</option>
                          {allBins.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.code} ({b.rack?.name || 'Rack'})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}

                  {isType1 ? (
                    <td className="px-4 py-3 text-right tabular-nums">
                      <input
                        type="hidden"
                        {...register(`items.${index}.expectedReturnQty` as const)}
                        value={initialExpectedQty}
                      />
                      <span className="font-mono text-sm font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                        {initialExpectedQty}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">Dispatched Target</span>
                    </td>
                  ) : (
                    <>
                      {/* Initial Expected Qty (Fixed Baseline from Creation, e.g. 700) */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                          {initialExpectedQty}
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Created Target</span>
                      </td>

                      {/* Expected Qty on Receipt (Editable, e.g. user changes from 700 to 650) */}
                      <td className="px-4 py-3 text-right tabular-nums">
                        {isClosed ? (
                          <span className="font-mono text-sm font-bold text-slate-800">{revisedExpectedQty}</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            <input
                              type="number"
                              step="0.001"
                              min={alreadyAccounted}
                              {...register(`items.${index}.expectedReturnQty` as const, {
                                required: 'Required',
                                valueAsNumber: true,
                                min: { value: alreadyAccounted, message: `Min ${alreadyAccounted}` },
                                onChange: (e) => {
                                  const newTarget = Number(e.target.value);
                                  setValue(`items.${index}.expectedOutputQuantity`, newTarget);
                                  const newRemaining = Math.max(0, newTarget - alreadyAccounted);
                                  const curReceived = Number(formItems[index]?.receivedQuantity || 0);
                                  if (curReceived > newRemaining || curReceived === 0) {
                                    setValue(`items.${index}.receivedQuantity`, newRemaining);
                                    setValue(`items.${index}.actualReceivedQty`, newRemaining);
                                  }
                                },
                              })}
                              className="w-28 h-10 px-3 rounded-lg border border-blue-300 bg-blue-50/50 text-sm text-right tabular-nums font-bold text-blue-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
                              title="Edit expected return quantity if vendor yield changed"
                            />
                            <span className="text-[10px] font-medium text-blue-600 mt-0.5">Edit Expected</span>
                          </div>
                        )}
                      </td>

                      {/* Expected Variation (Computed: Initial Expected - Revised Expected, e.g. 50) */}
                      <td className="px-4 py-3 text-center">
                        {hasVariation ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              Var: -{expectedVariation}
                            </span>
                            <span className="text-[10px] text-amber-700 font-medium mt-0.5">Yield Change</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            0 (100% Target)
                          </span>
                        )}
                      </td>
                    </>
                  )}

                  {/* Actual Received Qty (to QC) (e.g. 600) */}
                  <td className="px-4 py-3 text-right">
                    {isClosed || remainingTarget <= 0 ? (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                        Fully Received
                      </span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <input
                          type="number"
                          step="0.001"
                          {...register(`items.${index}.receivedQuantity` as const, {
                            required: 'Required',
                            valueAsNumber: true,
                            min: 0.001,
                            max: { value: remainingTarget, message: 'Exceeds remaining' },
                            onChange: (e) => {
                              const val = Number(e.target.value);
                              setValue(`items.${index}.actualReceivedQty`, val);
                            },
                          })}
                          className={`w-28 h-10 px-3 rounded-lg border text-sm text-right tabular-nums font-bold focus:outline-none focus:ring-2 ${
                            actualReceivedQty > remainingTarget || actualReceivedQty < 0.001
                              ? 'border-red-300 focus:ring-red-500 bg-red-50/20'
                              : 'border-emerald-300 focus:ring-emerald-500 bg-emerald-50/30 text-emerald-950 shadow-xs'
                          }`}
                        />
                        <span className="text-[10px] font-semibold text-emerald-700 mt-0.5">Physical Qty (to QC)</span>
                      </div>
                    )}
                  </td>

                  {/* Remaining at Vendor (Revised Expected - Actual Received, e.g. 50) */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {unreceivedBalanceAtVendor > 0 ? (
                      <div className="inline-flex flex-col items-end">
                        <span className="font-mono text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {unreceivedBalanceAtVendor} remaining
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Pending at vendor</span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        0 (Balance Clear)
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
