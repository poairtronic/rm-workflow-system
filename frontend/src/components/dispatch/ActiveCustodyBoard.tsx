import { useState } from 'react';
import { Clock, AlertTriangle, CheckCircle2, Eye, ArrowRight } from 'lucide-react';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';

interface ActiveCustodyBoardProps {
  challans: DeliveryChallanDto[];
  onSelect: (dc: DeliveryChallanDto) => void;
}

export function ActiveCustodyBoard({ challans, onSelect }: ActiveCustodyBoardProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'PARTIALLY_RETURNED' | 'CLOSED'>('ALL');

  // Filter based on selected status
  const activeChallans = challans.filter(dc => {
    if (dc.status === 'DRAFT') return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'OPEN') return dc.status === 'OPEN' || dc.status === 'DISPATCHED';
    if (statusFilter === 'PARTIALLY_RETURNED') return dc.status === 'PARTIALLY_RETURNED';
    if (statusFilter === 'CLOSED') return dc.status === 'CLOSED' || dc.status === 'RETURNED';
    return true;
  });

  const counts = {
    all: challans.filter(dc => dc.status !== 'DRAFT').length,
    open: challans.filter(dc => dc.status === 'OPEN' || dc.status === 'DISPATCHED').length,
    partial: challans.filter(dc => dc.status === 'PARTIALLY_RETURNED').length,
    closed: challans.filter(dc => dc.status === 'CLOSED' || dc.status === 'RETURNED').length,
  };

  const getSlaStatus = (expectedReturnDate?: string, status?: string) => {
    if (status === 'CLOSED' || status === 'RETURNED') {
      return { label: 'Closed', color: 'bg-slate-100 text-slate-700', icon: CheckCircle2 };
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
      case 'DISPATCHED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">Open</span>;
      case 'PARTIALLY_RETURNED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">Partial</span>;
      case 'CLOSED':
      case 'RETURNED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">Closed</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Active Custody Board</h2>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'ALL'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              All
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-300 text-slate-800'
              }`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'OPEN'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/60'
              }`}
            >
              Open
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === 'OPEN' ? 'bg-white/20 text-white' : 'bg-blue-200 text-blue-900'
              }`}>
                {counts.open}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('PARTIALLY_RETURNED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'PARTIALLY_RETURNED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'
              }`}
            >
              Partial
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === 'PARTIALLY_RETURNED' ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {counts.partial}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('CLOSED')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'CLOSED'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300/60'
              }`}
            >
              Closed DC
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                statusFilter === 'CLOSED' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}>
                {counts.closed}
              </span>
            </button>
          </div>
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
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Vendor / Destination</th>
              <th className="px-6 py-3">Items & Materials</th>
              <th className="px-6 py-3">Issue Date</th>
              <th className="px-6 py-3">Target Return</th>
              <th className="px-6 py-3">SLA Status</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeChallans.map((dc) => {
              const sla = getSlaStatus(dc.expectedReturnDate, dc.status);
              const SlaIcon = sla.icon;
              const isClosed = dc.status === 'CLOSED' || dc.status === 'RETURNED';

              return (
                <tr key={dc.id} className="hover:bg-slate-50 transition-colors h-14">
                  <td className="px-6 py-2 font-medium text-slate-900 font-mono text-xs">{dc.dcNumber || dc.challanNumber}</td>
                  <td className="px-6 py-2">
                    {getStatusBadge(dc.status)}
                  </td>
                  <td className="px-6 py-2 text-slate-700 font-medium">{(dc as any).vendor?.name || dc.vendorName || dc.destinationEntity || dc.vendorId || 'N/A'}</td>
                  <td className="px-6 py-2 text-slate-600 max-w-xs">
                    {dc.items && dc.items.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {dc.items.slice(0, 2).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs truncate">
                            <span className="font-semibold text-slate-800">
                              {item.product?.code || item.product?.name || 'Material'}
                            </span>
                            <span className="text-slate-500 text-[11px]">
                              ({item.quantityDispatched ?? item.quantity} {item.product?.uom || 'qty'})
                            </span>
                            {item.sc?.scNumber && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-mono font-medium">
                                {item.sc.scNumber}
                              </span>
                            )}
                          </div>
                        ))}
                        {dc.items.length > 2 && (
                          <span className="text-[10px] text-slate-400 italic">
                            +{dc.items.length - 2} more item{dc.items.length - 2 > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No line items</span>
                    )}
                  </td>
                  <td className="px-6 py-2 tabular-nums text-slate-600 text-xs">
                    {dc.dispatchDate ? new Date(dc.dispatchDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-2 tabular-nums text-slate-600 text-xs">
                    {dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sla.color}`}>
                      <SlaIcon className="w-3.5 h-3.5" />
                      {sla.label}
                    </span>
                  </td>
                  <td className="px-6 py-2 text-right">
                    {isClosed ? (
                      <button
                        type="button"
                        onClick={() => onSelect(dc)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-200 hover:text-slate-900 transition-colors shadow-sm"
                      >
                        <Eye className="w-3 h-3 text-slate-500" />
                        View DC
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(dc)}
                        className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-md hover:bg-slate-50 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 shadow-sm"
                      >
                        Process Return
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {activeChallans.length === 0 && (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                  No delivery challans match your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
