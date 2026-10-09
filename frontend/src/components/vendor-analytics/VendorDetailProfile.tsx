import { 
  Building2, 
  Mail, 
  Phone, 
  Award, 
  ArrowLeft, 
  Package, 
  Clock, 
  FileText, 
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import type { VendorTraceabilityResponseDto } from '../../types/vendor-analytics.dto';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';

interface VendorDetailProfileProps {
  profile: VendorTraceabilityResponseDto;
  vendorSlas?: VendorSlaDto[];
  onBack: () => void;
}

export function VendorDetailProfile({ profile, vendorSlas = [], onBack }: VendorDetailProfileProps) {
  const { vendor, summary, itemsInCustody = [], challanBreakdown = [], associatedProcesses = [] } = profile;
  const isGoodScore = (summary?.slaComplianceRate ?? 100) >= 90;

  // Filter SLAs specifically for this vendor
  const relevantSlas = vendorSlas.filter(s => s.vendorId === vendor.id);

  return (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary transition-colors bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Vendor Directory
        </button>
      </div>

      {/* Profile Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  {vendor.code}
                </span>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{vendor.name}</h2>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  vendor.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}>
                  {vendor.isActive ? 'Active Vendor' : 'Inactive'}
                </span>
                {vendor.category && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                    {vendor.category}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-2.5 text-xs text-slate-600">
                {vendor.contactPerson && (
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="text-slate-400">Contact:</span> {vendor.contactPerson}
                  </span>
                )}
                {vendor.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {vendor.email}
                  </span>
                )}
                {vendor.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {vendor.phone}
                  </span>
                )}
                {vendor.address && (
                  <span className="text-slate-500 max-w-sm truncate" title={vendor.address}>
                    {vendor.address}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Metrics Badge Group */}
          <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 lg:border-l border-slate-200 pt-4 lg:pt-0 lg:pl-8">
            {/* SLA Score */}
            <div className="text-center sm:text-right">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-center sm:justify-end gap-1">
                <Award className="w-3.5 h-3.5 text-slate-400" /> SLA Adherence
              </p>
              <p className={`text-3xl font-black tabular-nums tracking-tight ${isGoodScore ? 'text-emerald-600' : 'text-amber-600'}`}>
                {summary?.slaComplianceRate != null ? summary.slaComplianceRate.toFixed(1) : '100.0'}%
              </p>
            </div>

            {/* In Custody */}
            <div className="text-center sm:text-right border-l border-slate-200 pl-4">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5 flex items-center justify-center sm:justify-end gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" /> In Custody
              </p>
              <p className="text-3xl font-black tabular-nums tracking-tight text-blue-700">
                {summary?.netBalanceInCustody ?? 0} <span className="text-sm font-semibold text-slate-500">units</span>
              </p>
            </div>
          </div>
        </div>

        {/* 4 Mini Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-xs text-slate-500 font-medium">Total Challans Dispatched</span>
            <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{summary?.totalDcCount ?? 0}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-xs text-slate-500 font-medium">Open / Closed DCs</span>
            <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
              {summary?.openDcCount ?? 0} <span className="text-xs text-slate-400 font-normal">Open</span> / {summary?.closedDcCount ?? 0} <span className="text-xs text-slate-400 font-normal">Closed</span>
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-xs text-slate-500 font-medium">Overdue Challans</span>
            <p className={`text-lg font-bold mt-1 tabular-nums ${summary?.overdueDcCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {summary?.overdueDcCount ?? 0}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <span className="text-xs text-slate-500 font-medium">Avg Turnaround</span>
            <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
              {summary?.averageTurnaroundDays ?? 0} <span className="text-xs text-slate-400 font-normal">days</span>
            </p>
          </div>
        </div>
      </div>

      {/* Configured Process SLAs Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Configured Process SLAs for {vendor.name}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Standard turnaround duration (TAT) agreed for each manufacturing process
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {relevantSlas.length} Active SLA{relevantSlas.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/30 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Process Name</th>
                <th className="px-6 py-3 text-center">Standard TAT</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-right">Associated DC Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {relevantSlas.map((sla) => {
                const assoc = associatedProcesses.find(p => p.processId === sla.processId);
                return (
                  <tr key={sla.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {sla.processName}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {sla.standardTatDays} Days
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {sla.isActive ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs text-slate-600">
                      {assoc ? (
                        <span>
                          <strong>{assoc.totalDcCount}</strong> DCs ({assoc.balanceInCustody} units pending)
                        </span>
                      ) : (
                        <span className="text-slate-400">No active dispatches</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {relevantSlas.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-slate-500">
                    <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No process-specific SLAs configured yet for this vendor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Items Currently Pending in Custody Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              Raw Materials Currently Held in Custody
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Net balance of material dispatched to this vendor that has not yet been inwarded
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            {itemsInCustody.length} Material Item{itemsInCustody.length === 1 ? '' : 's'} Pending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/30 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Product / Material</th>
                <th className="px-6 py-3 text-right">Dispatched Qty</th>
                <th className="px-6 py-3 text-right">Returned Qty</th>
                <th className="px-6 py-3 text-right">Balance in Custody</th>
                <th className="px-6 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsInCustody.map((item) => (
                <tr key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3.5">
                    <p className="font-semibold text-slate-900">{item.productName}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{item.productId}</p>
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium text-slate-700 tabular-nums">
                    {item.totalDispatched} units
                  </td>
                  <td className="px-6 py-3.5 text-right font-medium text-emerald-700 tabular-nums">
                    {item.totalReturned} units
                  </td>
                  <td className="px-6 py-3.5 text-right tabular-nums">
                    <span className="font-bold text-blue-700 text-sm bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      {item.balanceInCustody} units
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      With Vendor
                    </span>
                  </td>
                </tr>
              ))}

              {itemsInCustody.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    All dispatched materials have been returned. No pending custody balance for this vendor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Challan Breakdown History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-700" />
              Delivery Challans (DC) Breakdown & Status Log
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historical record of all dispatches, expected return dates, and turnaround SLA adherence
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {challanBreakdown.length} Total Challans
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/30 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Challan #</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Dispatched Date</th>
                <th className="px-6 py-3">Expected Return</th>
                <th className="px-6 py-3">Actual Return</th>
                <th className="px-6 py-3 text-right">Items / Custody</th>
                <th className="px-6 py-3 text-center">Status</th>
                <th className="px-6 py-3 text-center">SLA Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {challanBreakdown.map((dc) => {
                const totalDisp = dc.items?.reduce((s, i) => s + (i.quantityDispatched || 0), 0) || 0;
                const totalRet = dc.items?.reduce((s, i) => s + (i.quantityReturned || 0), 0) || 0;
                const balance = Math.max(0, totalDisp - totalRet);

                return (
                  <tr key={dc.dcId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-bold text-slate-900">{dc.challanNumber}</span>
                      {dc.scNumber && (
                        <p className="text-[11px] text-slate-400 mt-0.5">SC: {dc.scNumber}</p>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {dc.type}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 tabular-nums">
                      {dc.givenDate ? new Date(dc.givenDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-xs tabular-nums">
                      {dc.expectedReturnDate ? (
                        <span className={dc.isOverdue ? 'font-bold text-red-600' : 'text-slate-600'}>
                          {new Date(dc.expectedReturnDate).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-xs text-slate-600 tabular-nums">
                      {dc.actualReceiptDate ? new Date(dc.actualReceiptDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-right text-xs">
                      <span className="font-bold text-slate-900">{balance} units pending</span>
                      <p className="text-[11px] text-slate-400">{totalDisp} disp / {totalRet} ret</p>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        dc.status === 'CLOSED' || dc.status === 'RETURNED'
                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {dc.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {dc.isOverdue ? (
                        <span className="text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200 flex items-center justify-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" /> Overdue
                        </span>
                      ) : dc.isSlaBreached ? (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          SLA Breached
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> On Track
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {challanBreakdown.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-slate-500">
                    No challans recorded for this vendor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
