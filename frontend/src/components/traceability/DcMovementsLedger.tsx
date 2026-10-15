import { Truck, ArrowRight, CheckCircle2, Clock } from 'lucide-react';

interface DcMovement {
  id: string;
  challanId: string;
  challanNumber?: string;
  processName?: string;
  vendorName?: string;
  dispatchedProductId: string;
  dispatchedProductName?: string;
  dispatchedQty: number;
  returnedProductId?: string;
  returnedProductName?: string;
  returnedQty: number;
  status: string;
  createdAt: string;
}

interface DcMovementsLedgerProps {
  movements: DcMovement[];
}

export function DcMovementsLedger({ movements = [] }: DcMovementsLedgerProps) {
  if (movements.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
            Vendor Process Custody Ledger
          </h2>
        </div>
        <p className="text-sm text-slate-500">
          No external subcontracting / Type 1 delivery challan movements recorded for this component yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
              Vendor Process Custody Ledger (Type 1 DC Movements)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {movements.length} Record{movements.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Independent WIP running ledger tracking outward subcontracting custody per (SC, Product). Operations do not touch warehouse stock balances.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Challan No.</th>
              <th className="px-4 py-3">Subcontract Process</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3 text-right">Dispatched (Out)</th>
              <th className="px-4 py-3">Returned Product (In)</th>
              <th className="px-4 py-3 text-right">Returned (In)</th>
              <th className="px-4 py-3 text-right">In Vendor Custody</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3">Dispatched Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => {
              const dispQty = Number(m.dispatchedQty || 0);
              const retQty = Number(m.returnedQty || 0);
              const balance = Math.max(0, dispQty - retQty);
              const isMutated =
                m.returnedProductId &&
                m.dispatchedProductId &&
                m.returnedProductId !== m.dispatchedProductId;

              return (
                <tr key={m.id} className="h-14 hover:bg-slate-50/50">
                  {/* Challan No */}
                  <td className="px-4 py-3 font-mono font-semibold text-primary">
                    {m.challanNumber || m.challanId.slice(0, 8)}
                  </td>

                  {/* Process */}
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {m.processName || 'External Operation'}
                  </td>

                  {/* Vendor */}
                  <td className="px-4 py-3 text-slate-700">
                    {m.vendorName || 'Vendor'}
                  </td>

                  {/* Dispatched */}
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-rose-700 tabular-nums">
                      -{dispQty.toFixed(3)}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[150px]">
                      {m.dispatchedProductName || 'Dispatched Item'}
                    </p>
                  </td>

                  {/* Returned Product */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-slate-900">
                        {m.returnedProductName || m.dispatchedProductName || '—'}
                      </span>
                      {isMutated && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Converted
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Returned Qty */}
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-emerald-700 tabular-nums">
                      +{retQty.toFixed(3)}
                    </p>
                  </td>

                  {/* Balance in Custody */}
                  <td className="px-4 py-3 text-right font-bold tabular-nums">
                    <span className={balance > 0 ? 'text-amber-700' : 'text-slate-400'}>
                      {balance.toFixed(3)}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3 text-center">
                    {m.status === 'RETURNED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3" />
                        Returned
                      </span>
                    ) : m.status === 'PARTIALLY_RETURNED' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                        <Clock className="w-3 h-3" />
                        Partial
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        <ArrowRight className="w-3 h-3" />
                        Out at Vendor
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

