export interface DeliveryChallanPayloadItem {
  id: string;
  productId: string;
  productName: string;
  binId: string;
  binCode: string;
  binName: string;
  quantityDispatched: number;
  quantityReturned: number;
  quantityOutstanding: number;
  scNumber?: string;
  poNumber?: string;
  processName?: string;
  batchNumber?: string;
  grossWeightKg?: number; // fallback
  quantity?: number; // fallback
  materialCode?: string; // fallback
  nomenclature?: string; // fallback
  uom?: string; // fallback
}

export interface PrintableGroupItem {
  productCode?: string | null;
  productName?: string;
  binCode?: string;
  batchNumber?: string;
  description?: string;
  quantityDispatched: number;
}

export interface PrintableGroup {
  scNumber: string;
  poNumber: string;
  processName: string;
  items: PrintableGroupItem[];
  groupTotal: number;
}

interface PrintablePayloadGridProps {
  items: DeliveryChallanPayloadItem[];
  groups?: PrintableGroup[];
  pos?: any[];
}

export function PrintablePayloadGrid({ items, groups, pos }: PrintablePayloadGridProps) {
  if (groups && groups.length > 0) {
    const overallTotal = groups.reduce((sum, g) => sum + (g.groupTotal || 0), 0);
    const distinctPos = Array.from(new Set(groups.map(g => g.poNumber).filter(Boolean)));

    return (
      <div className="mb-6 space-y-4">
        {distinctPos.length > 0 && (
          <div className="mb-3 text-xs">
            <strong>Associated Purchase Orders: </strong>
            {distinctPos.join(', ')}
          </div>
        )}

        {groups.map((group, gIdx) => (
          <div key={`group-${gIdx}`} className="border border-black p-3 mb-4 rounded-sm break-inside-avoid">
            <div className="flex justify-between items-center bg-slate-100 p-2 border-b border-black mb-2 text-xs font-bold text-black print:bg-transparent">
              <div>
                <span>SC: {group.scNumber || 'N/A'}</span>
                <span className="mx-2">|</span>
                <span>PO: {group.poNumber || 'N/A'}</span>
              </div>
              <div>
                <span>Process: {group.processName || 'N/A'}</span>
              </div>
            </div>

            <table className="w-full border-collapse border border-black text-xs">
              <thead className="bg-slate-50 print:bg-transparent">
                <tr>
                  <th className="border border-black px-2 py-1 text-center w-10 text-[10px] uppercase font-bold text-black">S.No</th>
                  <th className="border border-black px-2 py-1 text-left text-[10px] uppercase font-bold text-black">Product Code & Name</th>
                  <th className="border border-black px-2 py-1 text-center text-[10px] uppercase font-bold text-black">Bin</th>
                  <th className="border border-black px-2 py-1 text-center text-[10px] uppercase font-bold text-black">Batch No</th>
                  <th className="border border-black px-2 py-1 text-left text-[10px] uppercase font-bold text-black">Description</th>
                  <th className="border border-black px-2 py-1 text-right w-20 text-[10px] uppercase font-bold text-black">Qty</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item, idx) => (
                  <tr key={idx} className="break-inside-avoid">
                    <td className="border border-black px-2 py-1 text-center font-medium">{idx + 1}</td>
                    <td className="border border-black px-2 py-1">
                      <p className="font-bold text-black">{item.productName || item.productCode}</p>
                      {item.productCode && item.productCode !== item.productName && (
                        <p className="text-[10px] text-slate-700 font-mono">{item.productCode}</p>
                      )}
                    </td>
                    <td className="border border-black px-2 py-1 text-center text-[10px]">{item.binCode || '-'}</td>
                    <td className="border border-black px-2 py-1 text-center text-[10px] font-mono">{item.batchNumber || '-'}</td>
                    <td className="border border-black px-2 py-1 text-[10px]">{item.description || '-'}</td>
                    <td className="border border-black px-2 py-1 text-right tabular-nums font-bold">{item.quantityDispatched}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className="border border-black px-2 py-1 text-right font-bold text-[10px] uppercase text-black">Group Total</td>
                  <td className="border border-black px-2 py-1 text-right font-bold tabular-nums text-black">{group.groupTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <div className="flex justify-end p-2 border border-black bg-slate-100 text-xs font-bold text-black print:bg-transparent">
          <span>Overall Total Quantity Dispatched: {overallTotal}</span>
        </div>
      </div>
    );
  }

  const totalQuantity = items.reduce((acc, item) => acc + (item.quantityDispatched ?? item.quantity ?? 0), 0);
  const totalGrossWeight = items.reduce((acc, item) => acc + (item.grossWeightKg || 0), 0);

  return (
    <div className="mb-6">
      {pos && pos.length > 0 && (
        <div className="mb-4 text-xs">
          <strong>Associated Purchase Orders: </strong>
          {pos.map(po => po.poNumber).join(', ')}
        </div>
      )}
      <table className="w-full border-collapse border border-black text-xs">
        <thead className="bg-slate-100 print:bg-transparent">
          <tr>
            <th className="border border-black px-2 py-1.5 text-center w-12 text-[10px] uppercase font-bold text-black">S.No</th>
            <th className="border border-black px-2 py-1.5 text-left text-[10px] uppercase font-bold text-black">Item Description & SC/PO</th>
            <th className="border border-black px-2 py-1.5 text-center text-[10px] uppercase font-bold text-black">Process</th>
            <th className="border border-black px-2 py-1.5 text-center w-24 text-[10px] uppercase font-bold text-black">Source Batch</th>
            <th className="border border-black px-2 py-1.5 text-right w-24 text-[10px] uppercase font-bold text-black">Gross Wt (kg)</th>
            <th className="border border-black px-2 py-1.5 text-right w-24 text-[10px] uppercase font-bold text-black">Qty</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || `${item.materialCode}-${idx}`} className="break-inside-avoid">
              <td className="border border-black px-2 py-1.5 text-center font-medium">{idx + 1}</td>
              <td className="border border-black px-2 py-1.5">
                <p className="font-bold text-black">{item.productName || item.nomenclature || item.materialCode}</p>
                <p className="text-[10px] text-slate-700">SC: {item.scNumber || 'N/A'} | PO: {item.poNumber || 'N/A'}</p>
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-[10px]">
                {item.processName || 'N/A'}
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-[10px] font-mono">
                {item.batchNumber || '-'}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {item.grossWeightKg?.toFixed(2) || '0.00'}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums font-bold">
                {item.quantityDispatched ?? item.quantity} {item.uom || 'Nos'}
              </td>
            </tr>
          ))}
          
          {/* Summary Row */}
          <tr className="break-inside-avoid">
            <td colSpan={4} className="border border-black px-2 py-1.5 text-right font-bold text-[10px] uppercase text-black">
              Total
            </td>
            <td className="border border-black px-2 py-1.5 text-right font-bold tabular-nums text-black">
              {totalGrossWeight.toFixed(2)}
            </td>
            <td className="border border-black px-2 py-1.5 text-right font-bold tabular-nums text-black">
              {totalQuantity}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
