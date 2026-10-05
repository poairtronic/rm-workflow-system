import { useFieldArray, useFormContext } from 'react-hook-form';
import { AlertCircle, FileDigit } from 'lucide-react';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../../types/dc-return.dto';

interface ReconciliationGridProps {
  dc: DeliveryChallanDto;
}

export function ReconciliationGrid({ dc }: ReconciliationGridProps) {
  const { register, control, watch, setValue } = useFormContext<ProcessDcReturnDto>();
  const { fields } = useFieldArray({
    control,
    name: 'items'
  });

  const formItems = watch('items') || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <FileDigit className="w-5 h-5 text-primary" />
            Reconciliation Grid
          </h2>
          <p className="text-xs text-slate-500 mt-1">Record received quantities and calculate variances against DC #{dc.dcNumber}</p>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 w-1/4">Material & Batch</th>
              <th className="px-4 py-3 text-right">Dispatched</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3">Split (Usable / Scrap)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field, index) => {
              // Find original item for read-only data
              const originalItem = dc.items.find(item => item.id === (field as any).itemId) || dc.items[index];
              const dispatchedQty = Number(originalItem?.quantity || 0);
              
              const receivedQty = Number(formItems[index]?.receivedQuantity || 0);
              const variance = receivedQty - dispatchedQty;
              const isShortfall = variance < 0;

              // Split logic
              const isSplit = formItems[index]?._isSplit; // We can use a local flag in the form state
              const usableQty = Number(formItems[index]?.usableQuantity || 0);
              const scrapQty = Number(formItems[index]?.scrapQuantity || 0);
              const splitMismatch = isSplit && (usableQty + scrapQty !== receivedQty);

              return (
                <tr key={field.id} className="h-14 hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{originalItem?.materialCode}</p>
                    <p className="text-xs text-slate-500">{originalItem?.batchNumber || 'N/A'}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                    {dispatchedQty} {originalItem?.uom}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="number"
                      step="0.1"
                      {...register(`items.${index}.receivedQuantity` as const, { 
                        required: 'Required',
                        min: 0,
                        onChange: (e) => {
                          const val = Number(e.target.value);
                          if (!isSplit) {
                            setValue(`items.${index}.usableQuantity`, val);
                            setValue(`items.${index}.scrapQuantity`, 0);
                          }
                        }
                      })}
                      className="w-24 h-10 px-3 rounded-lg border border-slate-200 text-sm text-right tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={`font-semibold ${isShortfall ? 'text-red-600' : 'text-slate-700'}`}>
                      {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(`items.${index}._isSplit` as const)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        Enable Scrap / Remanent Split
                      </label>
                      
                      {isSplit && (
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-slate-400 font-medium">Use</span>
                            <input
                              type="number"
                              step="0.1"
                              {...register(`items.${index}.usableQuantity` as const)}
                              className="w-20 h-8 pl-8 pr-2 rounded bg-slate-50 border border-slate-200 text-xs text-right tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          <span className="text-slate-400">+</span>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] uppercase text-slate-400 font-medium">Scr</span>
                            <input
                              type="number"
                              step="0.1"
                              {...register(`items.${index}.scrapQuantity` as const)}
                              className="w-20 h-8 pl-8 pr-2 rounded bg-slate-50 border border-slate-200 text-xs text-right tabular-nums text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          {splitMismatch && (
                            <AlertCircle className="w-4 h-4 text-red-500" title="Split sum must equal Received Qty" />
                          )}
                        </div>
                      )}
                    </div>
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
