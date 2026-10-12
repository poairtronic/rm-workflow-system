import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { AlertCircle, FileDigit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';
import { masterDataService } from '../../services/masterDataService';

export function ReconciliationGrid({ dc, isReadOnly }: { dc: any; isReadOnly?: boolean }) {
  const { register, control, setValue } = useFormContext<any>();
  const { fields } = useFieldArray({ control, name: 'items' });

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => unwrapList(await api.get<any[]>('/api/products?pageSize=1000')) });
  
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
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <FileDigit className="w-5 h-5 text-primary" />
            Reconciliation & Inward Grid
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isClosed
              ? 'Finalized Delivery Challan: All lines are locked for administrative review.'
              : isType1 
                ? 'WIP Movement Return: Inward material back into production custody (does not affect warehouse stock).'
                : 'General Stock Conversion Return: Inward converted material directly into warehouse stock in target bin.'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Dispatched Item</th>
              <th className="px-4 py-3">Inward Returned Product</th>
              {!isType1 && <th className="px-4 py-3">Destination Bin</th>}
              <th className="px-4 py-3 text-right">{isType1 ? 'Dispatched' : 'Target Expected'}</th>
              <th className="px-4 py-3 text-right">Already Returned</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3">Split (Usable / Scrap)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field, index) => {
              const originalItem = dc.items?.find((item: any) => item.id === (field as any).itemId) || dc.items?.[index];
              const dispProduct = products?.find((p: any) => p.id === originalItem?.productId);
              
              const targetQty = !isType1 && originalItem?.expectedOutputQuantity
                ? Number(originalItem.expectedOutputQuantity)
                : Number(originalItem?.quantityDispatched || 0);

              const returnedQty = Number(originalItem?.quantityReturned || 0);
              const remaining = Math.max(0, targetQty - returnedQty);
              
              const receivedQty = Number(formItems[index]?.receivedQuantity || 0);
              const variance = remaining - receivedQty;
              const isShortfall = variance < 0;

              const isSplit = formItems[index]?._isSplit;
              const usableQty = Number(formItems[index]?.usableQuantity || 0);
              const scrapQty = Number(formItems[index]?.scrapQuantity || 0);
              const splitMismatch = isSplit && (usableQty + scrapQty !== receivedQty);

              return (
                <tr key={field.id} className="h-14 hover:bg-[#F8FAFC]">
                  {/* Dispatched Product */}
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{dispProduct?.code || originalItem?.product?.code || originalItem?.productId}</p>
                    <p className="text-xs text-slate-500">{dispProduct?.name || originalItem?.product?.name || ''}</p>
                  </td>

                  {/* Returned / Converted Product */}
                  <td className="px-4 py-3">
                    {isClosed ? (
                      <div>
                        <p className="font-medium text-slate-800 text-xs">
                          {products?.find((p: any) => p.id === (originalItem?.outputProductId || originalItem?.productId))?.code || '—'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {products?.find((p: any) => p.id === (originalItem?.outputProductId || originalItem?.productId))?.name || ''}
                        </p>
                      </div>
                    ) : (
                      <select
                        {...register(`items.${index}.returnedProductId` as const)}
                        className="w-48 h-9 px-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                      >
                        {originalItem?.outputProductId && (
                          <option value={originalItem.outputProductId}>
                            ★ Target: {products?.find((p: any) => p.id === originalItem.outputProductId)?.name || 'Expected Product'}
                          </option>
                        )}
                        {originalItem?.productId && (
                          <option value={originalItem.productId}>
                            Original: {dispProduct?.name || 'Same as Dispatched'}
                          </option>
                        )}
                        <optgroup label="Other Master Products">
                          {(products || []).slice(0, 50).map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.code} – {p.name}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                    )}
                  </td>

                  {/* Destination Bin (Type 2 only) */}
                  {!isType1 && (
                    <td className="px-4 py-3">
                      {isClosed ? (
                        <span className="text-xs font-medium text-slate-700">
                          {allBins.find((b: any) => b.id === (originalItem?.outputBinId || originalItem?.binId))?.code || '—'}
                        </span>
                      ) : (
                        <select
                          {...register(`items.${index}.destinationBinId` as const, {
                            required: !isType1 ? 'Destination bin is required' : false,
                          })}
                          className="w-40 h-9 px-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                        >
                          <option value="">Select Destination Bin...</option>
                          {allBins.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.code} ({b.rack?.name || 'Rack'})
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )}

                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                    {targetQty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                    {returnedQty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">
                    {remaining}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isClosed || remaining <= 0 ? (
                      <span className="text-xs font-semibold text-emerald-600">Fully Inwarded</span>
                    ) : (
                      <div className="flex flex-col items-end">
                        <input
                          type="number" step="0.001"
                          {...register(`items.${index}.receivedQuantity` as const, { 
                            required: 'Required',
                            valueAsNumber: true,
                            min: 0.001,
                            max: { value: remaining, message: 'Exceeds remaining' },
                            onChange: (e) => {
                              const val = Number(e.target.value);
                              if (!isSplit) {
                                setValue(`items.${index}.usableQuantity`, val);
                                setValue(`items.${index}.scrapQuantity`, 0);
                              }
                            }
                          })}
                          className={`w-24 h-10 px-3 rounded-lg border text-sm text-right tabular-nums focus:outline-none focus:ring-2 ${receivedQty > remaining || receivedQty < 0.001 ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'}`}
                        />
                        {(receivedQty > remaining || receivedQty < 0.001) && <span className="text-[10px] text-red-500 mt-1">Invalid</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {isClosed ? (
                      <span className="text-xs font-semibold text-emerald-600">Reconciled</span>
                    ) : (
                      <span className={`font-semibold ${isShortfall ? 'text-red-600' : 'text-slate-700'}`}>
                        {variance > 0 ? '+' : ''}{variance.toFixed(3)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isClosed ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-not-allowed" title="Not saved yet. DEFERRED: scrap needs a backend field and a rule on where scrap stock goes.">
                          <input
                            type="checkbox"
                            disabled
                            {...register(`items.${index}._isSplit` as const)}
                            className="rounded border-slate-300 text-primary focus:ring-primary disabled:opacity-50"
                          />
                          Enable Scrap / Remanent Split
                        </label>
                        
                        {isSplit && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number" step="0.001"
                              {...register(`items.${index}.usableQuantity` as const)}
                              className="w-20 h-8 pl-2 pr-2 rounded border border-slate-200 text-xs text-right tabular-nums"
                            />
                            <span className="text-slate-400">+</span>
                            <input
                              type="number" step="0.001"
                              {...register(`items.${index}.scrapQuantity` as const)}
                              className="w-20 h-8 pl-2 pr-2 rounded border border-slate-200 text-xs text-right tabular-nums"
                            />
                            {splitMismatch && (
                              <AlertCircle className="w-4 h-4 text-red-500" title="Split sum must equal Received Qty" />
                            )}
                          </div>
                        )}
                      </div>
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
