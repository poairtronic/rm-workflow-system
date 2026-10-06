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

interface PrintablePayloadGridProps {
  items: DeliveryChallanPayloadItem[];
  pos?: any[];
}

export function PrintablePayloadGrid({ items, pos }: PrintablePayloadGridProps) {
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
