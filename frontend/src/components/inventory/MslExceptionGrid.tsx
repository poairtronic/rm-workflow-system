import type { MslException } from '../../types/msl-alert';

const SeverityBadge = ({ severity }: { severity: MslException['severity'] }) => {
  if (severity === 'CRITICAL') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
        Critical
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      Low Stock
    </span>
  );
};

export interface MslExceptionGridProps {
  data: MslException[];
  onRaisePO?: (item: MslException) => void;
}

export function MslExceptionGrid({ data, onRaisePO }: MslExceptionGridProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm h-32 flex items-center justify-center">
        <p className="text-slate-500 text-sm">No stock breaches match the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="h-10 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-6 py-2">Item Details</th>
              <th className="px-6 py-2 text-right">Current Stock</th>
              <th className="px-6 py-2 text-right">MSL Threshold</th>
              <th className="px-6 py-2 text-right">Deficit</th>
              <th className="px-6 py-2 text-center">Severity</th>
              <th className="px-6 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, idx) => (
              <tr key={idx} className="h-14 hover:bg-slate-50 transition-colors">
                <td className="px-6 py-2">
                  <div className="font-medium text-slate-900">{item.itemName}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    <span className="tabular-nums">{item.sku}</span> <span className="opacity-50 mx-1">•</span> {item.category}
                  </div>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                  {item.currentStock.toLocaleString()}
                  <span className="text-[10px] text-slate-400 ml-1 font-sans uppercase tracking-wider">{item.unit}</span>
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-600">
                  {item.mslThreshold.toLocaleString()}
                  <span className="text-[10px] text-slate-400 ml-1 font-sans uppercase tracking-wider">{item.unit}</span>
                </td>
                <td className={`px-6 py-2 text-right tabular-nums font-semibold ${item.severity === 'CRITICAL' ? 'text-red-600' : 'text-amber-600'}`}>
                  {item.deficit.toLocaleString()}
                  <span className="text-[10px] ml-1 font-sans uppercase tracking-wider opacity-70">{item.unit}</span>
                </td>
                <td className="px-6 py-2 text-center">
                  <SeverityBadge severity={item.severity} />
                </td>
                <td className="px-6 py-2 text-right">
                  <button
                    onClick={() => onRaisePO && onRaisePO(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary shadow-sm transition-colors"
                  >
                    Raise PO
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
