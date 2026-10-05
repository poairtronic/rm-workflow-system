const fs = require('fs');

// Patch DockReceiptWorkspace.tsx
let dock = fs.readFileSync('frontend/src/pages/DockReceiptWorkspace.tsx', 'utf8');

dock = dock.replace(
  "receivedQuantity: item.quantity,",
  "receivedQuantity: (item as any).quantityDispatched - (item as any).quantityReturned,"
);
dock = dock.replace(
  "usableQuantity: item.quantity,",
  "usableQuantity: (item as any).quantityDispatched - (item as any).quantityReturned,"
);

// Add disable on buttons when mutation is pending
dock = dock.replace(
  /disabled=\{processReturnMutation\.isPending \|\| \!methods\.formState\.isValid\}/,
  "disabled={processReturnMutation.isPending || !methods.formState.isValid}"
);

// For the close button:
dock = dock.replace(
  /onClick=\{\(\) => setIsClosureModalOpen\(true\)\}/,
  "onClick={() => setIsClosureModalOpen(true)} disabled={processReturnMutation.isPending}"
);

fs.writeFileSync('frontend/src/pages/DockReceiptWorkspace.tsx', dock);

// Now rewrite ReconciliationGrid.tsx
const grid = `import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { AlertCircle, FileDigit } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapList } from '../../services/api';

export function ReconciliationGrid({ dc }: { dc: any }) {
  const { register, control, setValue } = useFormContext<any>();
  const { fields } = useFieldArray({ control, name: 'items' });

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: async () => unwrapList(await api.get<any[]>('/api/products')) });
  
  // Watch all items to compute real-time variances
  const formItems = useWatch({ control, name: 'items' }) || [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 flex items-center gap-2">
            <FileDigit className="w-5 h-5 text-primary" />
            Reconciliation Grid
          </h2>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Material</th>
              <th className="px-4 py-3 text-right">Dispatched</th>
              <th className="px-4 py-3 text-right">Already Returned</th>
              <th className="px-4 py-3 text-right">Remaining</th>
              <th className="px-4 py-3 text-right">Received Qty</th>
              <th className="px-4 py-3 text-right">Variance</th>
              <th className="px-4 py-3">Split (Usable / Scrap)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field, index) => {
              const originalItem = dc.items.find((item: any) => item.id === (field as any).itemId) || dc.items[index];
              const product = products?.find(p => p.id === originalItem?.productId);
              
              const dispatchedQty = Number(originalItem?.quantityDispatched || 0);
              const returnedQty = Number(originalItem?.quantityReturned || 0);
              const remaining = dispatchedQty - returnedQty;
              
              const receivedQty = Number(formItems[index]?.receivedQuantity || 0);
              const variance = remaining - receivedQty;
              const isShortfall = variance < 0;

              const isSplit = formItems[index]?._isSplit;
              const usableQty = Number(formItems[index]?.usableQuantity || 0);
              const scrapQty = Number(formItems[index]?.scrapQuantity || 0);
              const splitMismatch = isSplit && (usableQty + scrapQty !== receivedQty);

              return (
                <tr key={field.id} className="h-14 hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{product?.code}</p>
                    <p className="text-xs text-slate-500">{product?.name}</p>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                    {dispatchedQty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600 font-medium">
                    {returnedQty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">
                    {remaining}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end">
                      <input
                        type="number" step="0.001"
                        {...register(\`items.\${index}.receivedQuantity\` as const, { 
                          required: 'Required',
                          min: 0.001,
                          max: { value: remaining, message: 'Exceeds remaining' },
                          onChange: (e) => {
                            const val = Number(e.target.value);
                            if (!isSplit) {
                              setValue(\`items.\${index}.usableQuantity\`, val);
                              setValue(\`items.\${index}.scrapQuantity\`, 0);
                            }
                          }
                        })}
                        className={\`w-24 h-10 px-3 rounded-lg border text-sm text-right tabular-nums focus:outline-none focus:ring-2 \${receivedQty > remaining || receivedQty < 0.001 ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-primary'}\`}
                      />
                      {(receivedQty > remaining || receivedQty < 0.001) && <span className="text-[10px] text-red-500 mt-1">Invalid</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={\`font-semibold \${isShortfall ? 'text-red-600' : 'text-slate-700'}\`}>
                      {variance > 0 ? '+' : ''}{variance.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          {...register(\`items.\${index}._isSplit\` as const)}
                          className="rounded border-slate-300 text-primary focus:ring-primary"
                        />
                        Enable Scrap / Remanent Split
                      </label>
                      
                      {isSplit && (
                        <div className="flex items-center gap-2">
                          <input
                            type="number" step="0.001"
                            {...register(\`items.\${index}.usableQuantity\` as const)}
                            className="w-20 h-8 pl-2 pr-2 rounded border border-slate-200 text-xs text-right tabular-nums"
                          />
                          <span className="text-slate-400">+</span>
                          <input
                            type="number" step="0.001"
                            {...register(\`items.\${index}.scrapQuantity\` as const)}
                            className="w-20 h-8 pl-2 pr-2 rounded border border-slate-200 text-xs text-right tabular-nums"
                          />
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
`;
fs.writeFileSync('frontend/src/components/dispatch/ReconciliationGrid.tsx', grid);
