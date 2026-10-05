import { mockRequisitions } from '../../types/requisition';
import type { RequisitionStatus } from '../../types/requisition';

function StatusBadge({ status }: { status: RequisitionStatus }) {
  const isApproved = status === 'APPROVED';
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
        isApproved ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF3C7] text-[#B45309]'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isApproved ? 'bg-[#15803D]' : 'bg-[#B45309]'
        }`}
      />
      {status}
    </span>
  );
}

export function RequisitionQueueGrid() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="h-10 sticky top-0 bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              <th className="px-4 whitespace-nowrap align-middle font-semibold">Requisition ID</th>
              <th className="px-4 whitespace-nowrap align-middle font-semibold">SC Code</th>
              <th className="px-4 whitespace-nowrap align-middle font-semibold">Material Spec</th>
              <th className="px-4 whitespace-nowrap align-middle font-semibold text-right">Quantity</th>
              <th className="px-4 whitespace-nowrap align-middle font-semibold text-right">Target Time</th>
              <th className="px-4 whitespace-nowrap align-middle font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm text-slate-700">
            {mockRequisitions.map((req, idx) => (
              <tr
                key={req.id}
                className={`h-14 hover:bg-slate-50 transition-colors ${
                  idx !== mockRequisitions.length - 1 ? 'border-b border-slate-200' : ''
                }`}
              >
                <td className="px-4 whitespace-nowrap align-middle font-medium text-slate-900">
                  {req.id}
                </td>
                <td className="px-4 whitespace-nowrap align-middle text-slate-600">
                  {req.scCode}
                </td>
                <td className="px-4 whitespace-nowrap align-middle text-slate-600">
                  {req.materialSpec}
                </td>
                <td className="px-4 whitespace-nowrap align-middle text-right text-slate-900">
                  {req.quantity.toFixed(1)} <span className="text-slate-500 text-xs ml-0.5">{req.unit}</span>
                </td>
                <td className="px-4 whitespace-nowrap align-middle text-right text-slate-600">
                  {req.targetTime}
                </td>
                <td className="px-4 whitespace-nowrap align-middle">
                  <StatusBadge status={req.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
