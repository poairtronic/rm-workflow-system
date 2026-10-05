export interface DeliveryChallanPayloadItem {
  materialCode: string;
  nomenclature?: string;
  batchNumber: string;
  quantity: number;
  uom: string;
  grossWeightKg?: number;
}

interface PrintablePayloadGridProps {
  items: DeliveryChallanPayloadItem[];
}

export function PrintablePayloadGrid({ items }: PrintablePayloadGridProps) {
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalGrossWeight = items.reduce((acc, item) => acc + (item.grossWeightKg || 0), 0);

  return (
    <div className="mb-6">
      <table className="w-full border-collapse border border-black text-xs">
        <thead className="bg-slate-100 print:bg-transparent">
          <tr>
            <th className="border border-black px-2 py-1.5 text-center w-12 text-[10px] uppercase font-bold text-black">S.No</th>
            <th className="border border-black px-2 py-1.5 text-left text-[10px] uppercase font-bold text-black">Item Description & Specifications</th>
            <th className="border border-black px-2 py-1.5 text-center w-24 text-[10px] uppercase font-bold text-black">HSN Code</th>
            <th className="border border-black px-2 py-1.5 text-center w-24 text-[10px] uppercase font-bold text-black">Source Batch</th>
            <th className="border border-black px-2 py-1.5 text-right w-24 text-[10px] uppercase font-bold text-black">Gross Wt (kg)</th>
            <th className="border border-black px-2 py-1.5 text-right w-24 text-[10px] uppercase font-bold text-black">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`${item.materialCode}-${idx}`} className="break-inside-avoid">
              <td className="border border-black px-2 py-1.5 text-center font-medium">{idx + 1}</td>
              <td className="border border-black px-2 py-1.5">
                <p className="font-bold text-black">{item.nomenclature || item.materialCode}</p>
                <p className="text-[10px] text-slate-700">PID: {item.materialCode}</p>
              </td>
              <td className="border border-black px-2 py-1.5 text-center tabular-nums">
                7228.30.29 {/* Mock HSN Code for demonstration */}
              </td>
              <td className="border border-black px-2 py-1.5 text-center text-[10px] font-mono">
                {item.batchNumber}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums">
                {item.grossWeightKg?.toFixed(2) || '0.00'}
              </td>
              <td className="border border-black px-2 py-1.5 text-right tabular-nums font-bold">
                {item.quantity} {item.uom}
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
