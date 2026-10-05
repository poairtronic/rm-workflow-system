import { Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PoDcLog } from '../../types/po-traceability.dto';

interface PoDeliveryChallanLogProps {
  logs: PoDcLog[];
}

export function PoDeliveryChallanLog({ logs }: PoDeliveryChallanLogProps) {
  
  const getSlaStatus = (dc: PoDcLog) => {
    if (dc.status === 'CLOSED') {
      return { label: 'Closed', color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 };
    }
    
    if (!dc.expectedReturnDate) {
      return { label: 'No SLA', color: 'bg-slate-100 text-slate-700', icon: Clock };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dc.expectedReturnDate);
    target.setHours(0, 0, 0, 0);
    
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle };
    } else if (diffDays === 0) {
      return { label: 'Due Today', color: 'bg-amber-100 text-amber-700', icon: Clock };
    } else {
      return { label: 'On Track', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
            Cross-SC Vendor Movements
          </h2>
          <p className="text-xs text-slate-500 mt-1">Delivery Challan dispatches across all components in this PO</p>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3">DC Number</th>
              <th className="px-6 py-3">SC Ref</th>
              <th className="px-6 py-3">Vendor / Destination</th>
              <th className="px-6 py-3 tabular-nums">Dispatch Date</th>
              <th className="px-6 py-3 text-center">SLA Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const sla = getSlaStatus(log);
              const SlaIcon = sla.icon;
              return (
                <tr key={log.dcNumber} className="hover:bg-slate-50 transition-colors h-14">
                  <td className="px-6 py-2 font-medium text-slate-900">{log.dcNumber}</td>
                  <td className="px-6 py-2 text-slate-600">{log.scReference}</td>
                  <td className="px-6 py-2 text-slate-600">{log.vendorName}</td>
                  <td className="px-6 py-2 tabular-nums text-slate-600">
                    {log.dispatchDate ? new Date(log.dispatchDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-2 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sla.color}`}>
                      <SlaIcon className="w-3.5 h-3.5" />
                      {sla.label}
                    </span>
                  </td>
                </tr>
              );
            })}
            
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                  No Delivery Challans have been dispatched for this Purchase Order yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
