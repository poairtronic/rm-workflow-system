import { useState } from 'react';
import { Truck, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface ReworkEntry {
  id: string;
  sourceDcNumber: string;
  reworkDcNumber?: string;
  rejectedQty: number;
  uom: string;
  isSameVendor: boolean;
  reworkVendorName: string;
  originalVendorName?: string;
  reworkDispatchDate?: string;
  reworkActualReturnDate?: string;
  reworkStatus: string;
  qcRemarks?: string;
  summary: string;
}

interface DcMovement {
  id: string;
  challanId: string;
  challanNumber?: string;
  processName?: string;
  vendorName?: string;
  vendorCode?: string;
  dispatchedProductId: string;
  dispatchedProductName?: string;
  dispatchedQty: number;
  returnedProductId?: string;
  returnedProductName?: string;
  returnedQty: number;
  balanceQty?: number;
  status: string;
  dispatchDate?: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  deliveryTurnaround?: string;
  qcPassedQty?: number;
  qcRejectedQty?: number;
  qcPendingQty?: number;
  hasRework?: boolean;
  reworkItems?: ReworkEntry[];
  createdAt: string;
}

interface DcMovementsLedgerProps {
  movements: DcMovement[];
}

export function DcMovementsLedger({ movements = [] }: DcMovementsLedgerProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  if (movements.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
        <div className="flex items-center gap-2 mb-2">
          <Truck className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-bold text-slate-900 uppercase tracking-wide">
            Vendor Process & Rework Custody Ledger
          </h2>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          No external subcontracting / Delivery Challan movements recorded for this component yet.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Audit Trail Capabilities once Dispatched:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-600">
            <li>Tracks when the item is sent to vendor with DC number, dispatched quantity, and delivery SLA.</li>
            <li>Records vendor return date, actual quantity received, and QC inspection passed vs rework split.</li>
            <li>Full audit when sent to rework vendor: same vendor (same DC) or another vendor (new DC).</li>
            <li>Tracks rework return date, quantity received back, and QC clearance from same or another vendor.</li>
          </ul>
        </div>
      </div>
    );
  }

  const toggleRow = (id: string) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <h2 className="text-[15px] font-bold text-slate-900 uppercase tracking-wide">
              Vendor Process & Rework Custody Ledger
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {movements.length} Record{movements.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete subcontracting audit tracking when materials are sent to vendor, received, sent for rework to same or another vendor, and received back.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F8FAFC] border-y border-slate-200 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            <tr>
              <th className="px-4 py-3">Challan & Process</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Sent to Vendor (Out)</th>
              <th className="px-4 py-3">Received from Vendor (In)</th>
              <th className="px-4 py-3 text-center">QC Split</th>
              <th className="px-4 py-3">Rework Re-dispatch & Receipt</th>
              <th className="px-4 py-3 text-right">In Custody</th>
              <th className="px-4 py-3 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map((m) => {
              const dispQty = Number(m.dispatchedQty || 0);
              const retQty = Number(m.returnedQty || 0);
              const balance = m.balanceQty !== undefined ? Number(m.balanceQty) : Math.max(0, dispQty - retQty);
              const passedQty = Number(m.qcPassedQty || 0);
              const rejectedQty = Number(m.qcRejectedQty || 0);
              const reworks = m.reworkItems || [];
              const hasRework = reworks.length > 0 || rejectedQty > 0;
              const isExpanded = expandedRowId === m.id;

              return (
                <tr key={m.id} className="hover:bg-slate-50/60 transition-colors align-top">
                  {/* Challan & Process */}
                  <td className="px-4 py-3.5">
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200">
                      {m.challanNumber || m.challanId.slice(0, 8)}
                    </span>
                    <p className="text-xs font-semibold text-slate-900 mt-1">
                      {m.processName || 'Subcontract Operation'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate max-w-[160px]">
                      {m.dispatchedProductName || 'Component Part'}
                    </p>
                  </td>

                  {/* Vendor */}
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900 text-xs">
                      {m.vendorName || 'Vendor'}
                    </p>
                    {m.vendorCode && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {m.vendorCode}
                      </span>
                    )}
                  </td>

                  {/* Sent to Vendor (Out) */}
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-rose-700 tabular-nums text-xs">
                      {dispQty.toFixed(2)} Units
                    </p>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Sent: {m.dispatchDate ? new Date(m.dispatchDate).toLocaleDateString() : (m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—')}
                    </p>
                    {m.expectedReturnDate && (
                      <p className="text-[10px] text-slate-400">
                        Est: {new Date(m.expectedReturnDate).toLocaleDateString()}
                      </p>
                    )}
                  </td>

                  {/* Received from Vendor (In) */}
                  <td className="px-4 py-3.5">
                    {retQty > 0 || m.actualReturnDate ? (
                      <>
                        <p className="font-bold text-emerald-700 tabular-nums text-xs">
                          {retQty.toFixed(2)} Units
                        </p>
                        <p className="text-[11px] text-slate-700 font-medium mt-0.5">
                          Received: {m.actualReturnDate ? new Date(m.actualReturnDate).toLocaleDateString() : 'Inward Done'}
                        </p>
                        {m.deliveryTurnaround && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            {m.deliveryTurnaround}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3" />
                        In Transit / Pending
                      </span>
                    )}
                  </td>

                  {/* QC Split */}
                  <td className="px-4 py-3.5 text-center">
                    {retQty > 0 || passedQty > 0 || rejectedQty > 0 ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {passedQty > 0 ? passedQty : retQty} Passed
                        </span>
                        {rejectedQty > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            {rejectedQty} Rework
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>

                  {/* Rework Re-dispatch & Receipt */}
                  <td className="px-4 py-3.5 min-w-[260px]">
                    {!hasRework ? (
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Direct Pass / No Rework</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {reworks.map((rw) => (
                          <div key={rw.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                                rw.isSameVendor
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : 'bg-purple-100 text-purple-800 border-purple-200'
                              }`}>
                                {rw.isSameVendor ? 'Same Vendor' : 'Another Vendor'}
                              </span>
                              <span className="font-mono text-[11px] font-semibold text-slate-700">
                                DC: {rw.reworkDcNumber || rw.sourceDcNumber}
                              </span>
                            </div>

                            <p className="font-semibold text-slate-800">
                              Vendor: {rw.reworkVendorName}
                            </p>

                            <div className="text-[11px] text-slate-600 space-y-0.5">
                              <p>
                                <span className="text-slate-400">Sent for Rework:</span>{' '}
                                <span className="font-medium text-slate-800">
                                  {rw.reworkDispatchDate ? new Date(rw.reworkDispatchDate).toLocaleDateString() : 'Dispatched'}
                                </span>{' '}
                                ({rw.rejectedQty} {rw.uom})
                              </p>
                              <p>
                                <span className="text-slate-400">Received Back:</span>{' '}
                                {rw.reworkActualReturnDate ? (
                                  <span className="font-bold text-emerald-700">
                                    {new Date(rw.reworkActualReturnDate).toLocaleDateString()} (Cleared)
                                  </span>
                                ) : (
                                  <span className="text-amber-600 font-semibold">
                                    Pending Return
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>

                  {/* Balance in Custody */}
                  <td className="px-4 py-3.5 text-right font-bold tabular-nums text-xs">
                    <span className={balance > 0 ? 'text-amber-700 font-extrabold' : 'text-slate-400'}>
                      {balance.toFixed(2)}
                    </span>
                  </td>

                  {/* Action / Toggle */}
                  <td className="px-4 py-3.5 text-center">
                    {hasRework && (
                      <button
                        type="button"
                        onClick={() => toggleRow(m.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Toggle Rework Details"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
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

