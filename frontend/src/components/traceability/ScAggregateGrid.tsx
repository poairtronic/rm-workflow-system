import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PoScSummary } from '../../types/po-traceability.dto';

interface ScAggregateGridProps {
  scs: PoScSummary[];
}

export function ScAggregateGrid({ scs }: ScAggregateGridProps) {
  const navigate = useNavigate();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'CLOSED': return 'bg-slate-100 text-slate-700';
      case 'IN_PRODUCTION': return 'bg-blue-100 text-blue-700';
      case 'DRAFT': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
          Child Component Matrix
        </h2>
        <p className="text-xs text-slate-500 mt-1">Aggregate view of all Sales Order Components</p>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">SC ID</th>
              <th className="px-6 py-3">Nomenclature</th>
              <th className="px-6 py-3 text-right">Qty Ordered</th>
              <th className="px-6 py-3 text-right">Qty Completed</th>
              <th className="px-6 py-3 text-center">Status</th>
              <th className="px-6 py-3 text-right">Traceability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scs.map((sc) => (
              <tr 
                key={sc.scId} 
                className="h-14 hover:bg-[#F8FAFC] transition-colors group cursor-pointer"
                onClick={() => navigate(`/governance/traceability?scId=${sc.scId}`)}
              >
                <td className="px-6 py-2 font-medium text-slate-900">{sc.scId}</td>
                <td className="px-6 py-2 text-slate-600">{sc.nomenclature}</td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-700 font-medium">
                  {sc.quantityOrdered}
                </td>
                <td className="px-6 py-2 text-right tabular-nums text-slate-700 font-medium">
                  {sc.quantityCompleted}
                </td>
                <td className="px-6 py-2 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${getStatusStyle(sc.status)}`}>
                    {sc.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-2 text-right">
                  <div className="inline-flex items-center justify-end text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-medium mr-1">View Timeline</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </td>
              </tr>
            ))}
            {scs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                  No components associated with this PO.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
