import type { VendorCustodyItem } from '../../types/vendor-analytics.dto';
import { EscalationActionPanel } from './EscalationActionPanel';

interface ActiveCustodyGridProps {
  items: VendorCustodyItem[];
}

export function ActiveCustodyGrid({ items }: ActiveCustodyGridProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
          Active Custody Tracker
        </h2>
        <p className="text-xs text-slate-500 mt-1">Detailed log of all material currently held by this vendor</p>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">DC Number</th>
              <th className="px-6 py-3">Item Description</th>
              <th className="px-6 py-3">SC Ref</th>
              <th className="px-6 py-3 tabular-nums">Dispatched</th>
              <th className="px-6 py-3 tabular-nums text-center">SLA Date</th>
              <th className="px-6 py-3 text-right">Qty</th>
              <th className="px-6 py-3 text-right">Value ($)</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr 
                key={`${item.dcNumber}-${idx}`} 
                className={`h-14 transition-colors ${item.isOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-slate-50'}`}
              >
                <td className="px-6 py-2 font-medium text-slate-900">{item.dcNumber}</td>
                <td className="px-6 py-2 text-slate-600">{item.itemDescription}</td>
                <td className="px-6 py-2 text-slate-600">{item.scReference}</td>
                <td className="px-6 py-2 tabular-nums text-slate-600">
                  {new Date(item.dispatchedDate).toLocaleDateString()}
                </td>
                <td className="px-6 py-2 tabular-nums text-center">
                  <span className={`font-semibold ${item.isOverdue ? 'text-red-700' : 'text-slate-600'}`}>
                    {new Date(item.targetSlaDate).toLocaleDateString()}
                  </span>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-700">
                  {item.quantity}
                </td>
                <td className="px-6 py-2 text-right tabular-nums font-semibold text-slate-900">
                  {item.estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-2 text-right">
                  <EscalationActionPanel item={item} />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  No materials currently in custody for this vendor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
