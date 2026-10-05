import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';

interface ActiveCustodyBoardProps {
  challans: DeliveryChallanDto[];
  onSelect: (dc: DeliveryChallanDto) => void;
}

export function ActiveCustodyBoard({ challans, onSelect }: ActiveCustodyBoardProps) {
  // Filter only active challans (not CLOSED)
  const activeChallans = challans.filter(dc => dc.status !== 'CLOSED' && dc.status !== 'DRAFT');

  const getSlaStatus = (expectedReturnDate?: string) => {
    if (!expectedReturnDate) return { label: 'No SLA', color: 'bg-slate-100 text-slate-700', icon: Clock };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(expectedReturnDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
    } else if (diffDays === 0) {
      return { label: 'Due Today', color: 'bg-amber-100 text-amber-700', icon: Clock };
    } else {
      return { label: 'On Track', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Active Custody Board</h2>
          <p className="text-xs text-slate-500 mt-1">Monitor SLA status for open outbound materials</p>
        </div>
        <div className="flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-600"></div>On Track</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Due Today</span>
          <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-600"></div>Overdue</span>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">DC Number</th>
              <th className="px-6 py-3">Destination</th>
              <th className="px-6 py-3">Issue Date</th>
              <th className="px-6 py-3">Target Return</th>
              <th className="px-6 py-3">SLA Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeChallans.map((dc) => {
              const sla = getSlaStatus(dc.expectedReturnDate);
              const SlaIcon = sla.icon;
              return (
                <tr key={dc.id} className="hover:bg-slate-50 transition-colors h-14">
                  <td className="px-6 py-2 font-medium text-slate-900">{dc.dcNumber}</td>
                  <td className="px-6 py-2 text-slate-600">{dc.vendorName || dc.destinationEntity || dc.vendorId || 'N/A'}</td>
                  <td className="px-6 py-2 tabular-nums text-slate-600">
                    {dc.issueDate ? new Date(dc.issueDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-2 tabular-nums text-slate-600">
                    {dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sla.color}`}>
                      <SlaIcon className="w-3.5 h-3.5" />
                      {sla.label}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-right">
                    <button
                      onClick={() => onSelect(dc)}
                      className="inline-flex items-center justify-center px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      Process Return
                    </button>
                  </td>
                </tr>
              );
            })}
            
            {activeChallans.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-slate-500">
                  No active delivery challans in custody.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
