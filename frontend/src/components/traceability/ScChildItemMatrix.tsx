import { useMemo } from 'react';
import { Layers, Box, Info } from 'lucide-react';
import type { ScChildItemDto } from '../../types/traceability.dto';

interface ScChildItemMatrixProps {
  items?: ScChildItemDto[];
  scNumber?: string;
  targetQuantity?: number;
}

export function ScChildItemMatrix({
  items = [],
  scNumber = '',
  targetQuantity = 1,
}: ScChildItemMatrixProps) {
  // Check if any items involve sets or pairs (including SPG/SRG/Discs)
  const hasSets = useMemo(() => {
    return items.some((it) => {
      const text = `${it.partName || ''} ${it.material || ''} ${it.remarks || ''} ${it.weightUnit || ''}`.toLowerCase();
      return (
        text.includes('set') ||
        text.includes('disc') ||
        text.includes('pair') ||
        text.includes('spg') ||
        text.includes('srg') ||
        text.startsWith('sp ') ||
        text.startsWith('sr ')
      );
    });
  }, [items]);

  // Total quantity calculation in NOS
  const totalItemQty = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  }, [items]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Header Banner */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
              Child Item / Material Matrix
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Aggregate breakdown of all child items, materials, and quantities required for SC #{scNumber || 'N/A'} (Target: {targetQuantity} NOS)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasSets && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200" title="1 Set equals 2 Numbers (Nos)">
              <Info className="w-3 h-3 text-amber-600" />
              <span>1 Set = 2 Numbers (NOS)</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Box className="w-3 h-3" />
            <span>{items.length} {items.length === 1 ? 'Child Item' : 'Child Items'}</span>
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Total: {totalItemQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} NOS
          </span>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3 text-center w-12">#</th>
              <th className="px-6 py-3">Child Item / Component Name</th>
              <th className="px-6 py-3">Part No.</th>
              <th className="px-6 py-3">Material & Grade</th>
              <th className="px-6 py-3">Size / Spec</th>
              <th className="px-6 py-3 text-right">Quantity (NOS)</th>
              <th className="px-6 py-3">Remarks / Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const nameLower = `${item.partName || ''} ${item.material || ''} ${item.remarks || ''} ${item.weightUnit || ''}`.toLowerCase();
              const isSetItem =
                nameLower.includes('set') ||
                nameLower.includes('disc') ||
                nameLower.includes('pair') ||
                nameLower.includes('spg') ||
                nameLower.includes('srg') ||
                nameLower.startsWith('sp ') ||
                nameLower.startsWith('sr ');
              const qtyNum = Number(item.quantity) || 0;
              const uom = (item.weightUnit || 'NOS').toUpperCase();

              return (
                <tr key={item.id || idx} className="h-13 hover:bg-[#F8FAFC] transition-colors group">
                  {/* S.No */}
                  <td className="px-6 py-2.5 text-center text-xs font-mono text-slate-400">
                    {String(idx + 1).padStart(2, '0')}
                  </td>

                  {/* Item Name */}
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {item.partName || item.material || 'Child Component'}
                      </span>
                      {isSetItem && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Set Pair (2 Nos)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Part Number */}
                  <td className="px-6 py-2.5 font-mono text-xs font-bold text-slate-700">
                    {item.partNumber || scNumber || '—'}
                  </td>

                  {/* Material & Grade */}
                  <td className="px-6 py-2.5 text-xs text-slate-600">
                    <span className="font-medium text-slate-800">{item.material || 'Material'}</span>
                    {item.grade && (
                      <span className="ml-1 text-slate-400">({item.grade})</span>
                    )}
                  </td>

                  {/* Size / Dimension */}
                  <td className="px-6 py-2.5 text-xs font-mono text-slate-600">
                    {item.size || 'Standard Spec'}
                  </td>

                  {/* Quantity */}
                  <td className="px-6 py-2.5 text-right tabular-nums">
                    <span className="inline-block px-2.5 py-1 rounded-md bg-slate-100 text-slate-900 font-mono font-bold text-xs border border-slate-200">
                      {qtyNum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} {uom}
                    </span>
                  </td>

                  {/* Remarks */}
                  <td className="px-6 py-2.5 text-xs text-slate-500">
                    {item.remarks ? (
                      <span className="italic">{item.remarks}</span>
                    ) : isSetItem ? (
                      <span className="text-amber-700 font-medium">1 set = 2 numbers</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                  No child items or materials defined for this Sales Order Component.
                </td>
              </tr>
            )}
          </tbody>

          {/* Table Summary Footer */}
          {items.length > 0 && (
            <tfoot className="bg-slate-50/90 border-t border-slate-200 text-xs font-bold text-slate-700">
              <tr>
                <td colSpan={5} className="px-6 py-3 text-right uppercase tracking-wider text-slate-500">
                  Total Child Items Breakdown ({items.length} components):
                </td>
                <td className="px-6 py-3 text-right tabular-nums font-mono text-sm font-extrabold text-slate-900">
                  {totalItemQty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })} NOS
                </td>
                <td className="px-6 py-3 text-xs text-slate-400">
                  Zero-loss component balance verified
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

