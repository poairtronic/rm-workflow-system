import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Eye,
  ArrowRight,
  ShieldCheck,
  PackageCheck,
  RotateCcw,
} from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import type { DeliveryChallanDto } from '../../types/delivery-challan.dto';
import { ReworkQueueTable } from './ReworkQueueTable';

export type CustodyBoardTab =
  | 'ALL'
  | 'OPEN'
  | 'PARTIALLY_RETURNED'
  | 'QUALITY_CHECK'
  | 'REWORK'
  | 'CLOSED';

interface ActiveCustodyBoardProps {
  challans: DeliveryChallanDto[];
  onSelect: (dc: DeliveryChallanDto) => void;
  onInspectQc?: (dc: DeliveryChallanDto) => void;
  defaultTab?: CustodyBoardTab;
}

export function getDcItemStats(dc: DeliveryChallanDto) {
  const items = dc.items || [];
  let totalDispatched = 0;
  let totalQcPending = 0;
  let totalQcPassed = 0;
  let totalQcRejected = 0;

  for (const item of items) {
    const isType1 = dc.type === 'PRODUCTION_PROCESS_OUTWARD';
    const target =
      !isType1 && item.expectedOutputQuantity
        ? Number(item.expectedOutputQuantity)
        : Number(item.quantityDispatched ?? item.quantity ?? 0);
    totalDispatched += target;
    totalQcPending += Number(item.qcPendingQty || 0);
    totalQcPassed += Number(item.qcPassedQty || 0);
    totalQcRejected += Number(item.qcRejectedQty || 0);
  }

  const pendingVendorQty = Math.max(
    0,
    totalDispatched - totalQcPending - totalQcPassed - totalQcRejected
  );

  return {
    totalDispatched,
    totalQcPending,
    totalQcPassed,
    totalQcRejected,
    pendingVendorQty,
  };
}

export function ActiveCustodyBoard({
  challans,
  onSelect,
  onInspectQc,
  defaultTab = 'ALL',
}: ActiveCustodyBoardProps) {
  const [statusFilter, setStatusFilter] = useState<CustodyBoardTab>(defaultTab);

  const { data: reworkItems = [] } = useQuery({
    queryKey: ['rework-items'],
    queryFn: () => deliveryChallanApi.getReworkItems(),
    staleTime: 30000,
  });

  const activeReworkCount = useMemo(() => {
    return (reworkItems as any[]).filter(
      (r) => r.reworkStatus !== 'RE_DISPATCHED'
    ).length;
  }, [reworkItems]);

  // Compute stats and categorization for all challans
  const challanStatsMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getDcItemStats>>();
    for (const dc of challans) {
      map.set(dc.id, getDcItemStats(dc));
    }
    return map;
  }, [challans]);

  const counts = useMemo(() => {
    let all = 0;
    let open = 0;
    let partial = 0;
    let qc = 0;
    let closed = 0;

    for (const dc of challans) {
      if (dc.status === 'DRAFT') continue;
      all++;
      const stats = challanStatsMap.get(dc.id) || {
        totalDispatched: 0,
        totalQcPending: 0,
        totalQcPassed: 0,
        totalQcRejected: 0,
        pendingVendorQty: 0,
      };

      if (stats.totalQcPending > 0) {
        qc++;
      }

      if (dc.status === 'CLOSED' || dc.status === 'RETURNED') {
        closed++;
      } else if (
        (dc.status === 'OPEN' || dc.status === 'DISPATCHED') &&
        stats.totalQcPending === 0 &&
        stats.totalQcPassed === 0 &&
        stats.totalQcRejected === 0
      ) {
        open++;
      } else if (
        dc.status === 'PARTIALLY_RETURNED' ||
        (stats.pendingVendorQty > 0 &&
          (stats.totalQcPassed > 0 ||
            stats.totalQcRejected > 0 ||
            stats.totalQcPending > 0))
      ) {
        partial++;
      }
    }

    return {
      all,
      open,
      partial,
      qc,
      rework: activeReworkCount,
      closed,
    };
  }, [challans, challanStatsMap, activeReworkCount]);

  // Filter based on selected status
  const activeChallans = useMemo(() => {
    return challans.filter((dc) => {
      if (dc.status === 'DRAFT') return false;
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'CLOSED') {
        return dc.status === 'CLOSED' || dc.status === 'RETURNED';
      }

      const stats = challanStatsMap.get(dc.id) || {
        totalDispatched: 0,
        totalQcPending: 0,
        totalQcPassed: 0,
        totalQcRejected: 0,
        pendingVendorQty: 0,
      };

      if (statusFilter === 'QUALITY_CHECK') {
        return stats.totalQcPending > 0;
      }
      if (statusFilter === 'OPEN') {
        return (
          (dc.status === 'OPEN' || dc.status === 'DISPATCHED') &&
          stats.totalQcPending === 0 &&
          stats.totalQcPassed === 0 &&
          stats.totalQcRejected === 0
        );
      }
      if (statusFilter === 'PARTIALLY_RETURNED') {
        return (
          dc.status === 'PARTIALLY_RETURNED' ||
          (dc.status !== 'CLOSED' &&
            dc.status !== 'RETURNED' &&
            stats.pendingVendorQty > 0 &&
            (stats.totalQcPassed > 0 ||
              stats.totalQcRejected > 0 ||
              stats.totalQcPending > 0))
        );
      }
      return true;
    });
  }, [challans, statusFilter, challanStatsMap]);

  const getSlaStatus = (expectedReturnDate?: string, status?: string) => {
    if (status === 'CLOSED' || status === 'RETURNED') {
      return {
        label: 'Closed',
        color: 'bg-slate-100 text-slate-700',
        icon: CheckCircle2,
      };
    }
    if (!expectedReturnDate)
      return { label: 'No SLA', color: 'bg-slate-100 text-slate-700', icon: Clock };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(expectedReturnDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: 'Overdue',
        color: 'bg-red-100 text-red-700',
        icon: AlertTriangle,
      };
    } else if (diffDays === 0) {
      return {
        label: 'Due Today',
        color: 'bg-amber-100 text-amber-700',
        icon: Clock,
      };
    } else {
      return {
        label: 'On Track',
        color: 'bg-green-100 text-green-700',
        icon: CheckCircle2,
      };
    }
  };

  const getStatusBadge = (status: string, hasQcPending: boolean) => {
    if (hasQcPending) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          QC Pending
        </span>
      );
    }
    switch (status) {
      case 'OPEN':
      case 'DISPATCHED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
            Open
          </span>
        );
      case 'PARTIALLY_RETURNED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700">
            Partial
          </span>
        );
      case 'CLOSED':
      case 'RETURNED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      {/* Tab Navigation Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary" />
            Active Custody Board & QC Engine
          </h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {/* Tab 1: All */}
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
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'ALL'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-300 text-slate-800'
                }`}
              >
                {counts.all}
              </span>
            </button>

            {/* Tab 2: Open */}
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
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'OPEN'
                    ? 'bg-white/20 text-white'
                    : 'bg-blue-200 text-blue-900'
                }`}
              >
                {counts.open}
              </span>
            </button>

            {/* Tab 3: Partial */}
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
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'PARTIALLY_RETURNED'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-200 text-amber-900'
                }`}
              >
                {counts.partial}
              </span>
            </button>

            {/* Tab 4: Quality Check (NEW) */}
            <button
              type="button"
              onClick={() => setStatusFilter('QUALITY_CHECK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'QUALITY_CHECK'
                  ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Quality Check
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'QUALITY_CHECK'
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-200 text-purple-900'
                }`}
              >
                {counts.qc}
              </span>
            </button>

            {/* Tab 5: Rework (NEW) */}
            <button
              type="button"
              onClick={() => setStatusFilter('REWORK')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                statusFilter === 'REWORK'
                  ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-300'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Rework Queue
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'REWORK'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-200 text-rose-900'
                }`}
              >
                {counts.rework}
              </span>
            </button>

            {/* Tab 6: Closed DC */}
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
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'CLOSED'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 text-slate-800'
                }`}
              >
                {counts.closed}
              </span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs font-medium items-center">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-600"></div>On Track
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>Due Today
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-600"></div>Overdue
          </span>
        </div>
      </div>

      {/* Render Rework Queue if Tab 5 selected */}
      {statusFilter === 'REWORK' ? (
        <div className="p-4 bg-slate-50/50">
          <ReworkQueueTable onSelectDc={onSelect} challans={challans} />
        </div>
      ) : (
        /* Regular DC Custody Table */
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-white border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-3">DC Number & Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Vendor / Destination</th>
                <th className="px-6 py-3">Custody Split Matrix (10 → 5 → 2/3)</th>
                <th className="px-6 py-3">Items & Materials</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Target Return & SLA</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeChallans.map((dc) => {
                const stats = challanStatsMap.get(dc.id) || {
                  totalDispatched: 0,
                  totalQcPending: 0,
                  totalQcPassed: 0,
                  totalQcRejected: 0,
                  pendingVendorQty: 0,
                };
                const sla = getSlaStatus(dc.expectedReturnDate, dc.status);
                const SlaIcon = sla.icon;
                const isClosed =
                  dc.status === 'CLOSED' || dc.status === 'RETURNED';
                const isType1 = dc.type === 'PRODUCTION_PROCESS_OUTWARD';

                return (
                  <tr
                    key={dc.id}
                    className="hover:bg-slate-50 transition-colors h-16"
                  >
                    {/* DC Number & Type */}
                    <td className="px-6 py-3 font-medium text-slate-900 font-mono text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">
                          {dc.dcNumber || dc.challanNumber}
                        </span>
                        <span className="text-[10px] text-slate-500 font-sans mt-0.5">
                          {isType1 ? 'Type 1: Process' : 'Type 2: Conversion'}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-3">
                      {getStatusBadge(dc.status, stats.totalQcPending > 0)}
                    </td>

                    {/* Vendor */}
                    <td className="px-6 py-3 text-slate-700 font-medium">
                      {(dc as any).vendor?.name ||
                        dc.vendorName ||
                        dc.destinationEntity ||
                        dc.vendorId ||
                        'N/A'}
                    </td>

                    {/* Custody Split Matrix Badge (10 -> 5 -> 2/3 Rule) */}
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono tabular-nums">
                        <span
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          title="Original Dispatched Quantity"
                        >
                          Sent: <strong>{stats.totalDispatched}</strong>
                        </span>
                        <span
                          className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                          title="Quality Check Passed Quantity"
                        >
                          Passed: <strong>{stats.totalQcPassed}</strong>
                        </span>
                        {stats.totalQcRejected > 0 && (
                          <span
                            className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 font-semibold"
                            title="Rejected / In Rework Loop"
                          >
                            Rework: <strong>{stats.totalQcRejected}</strong>
                          </span>
                        )}
                        {stats.totalQcPending > 0 && (
                          <span
                            className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold animate-pulse"
                            title="Awaiting Inspector Quality Check"
                          >
                            QC: <strong>{stats.totalQcPending}</strong>
                          </span>
                        )}
                        {stats.pendingVendorQty > 0 && (
                          <span
                            className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                            title="Remaining Balance in Vendor Custody"
                          >
                            Vendor: <strong>{stats.pendingVendorQty}</strong>
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Items & Materials */}
                    <td className="px-6 py-3 text-slate-600 max-w-xs">
                      {dc.items && dc.items.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          {dc.items.slice(0, 2).map((item: any, idx: number) => {
                            const itemDispatched = Number(item.quantityDispatched ?? item.quantity ?? 0);
                            const itemPassed = Number(item.qcPassedQty || 0);
                            const itemRejected = Number(item.qcRejectedQty || 0);
                            const itemQc = Number(item.qcPendingQty || 0);
                            const itemVendor = Math.max(0, itemDispatched - (itemPassed + itemRejected + itemQc));
                            const hasActivity = itemPassed > 0 || itemRejected > 0 || itemQc > 0;

                            return (
                              <div key={idx} className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-xs truncate">
                                  <span className="font-semibold text-slate-800">
                                    {item.product?.code ||
                                      item.product?.name ||
                                      item.partName ||
                                      'Material'}
                                  </span>
                                  <span className="text-slate-500 text-[11px]">
                                    ({itemDispatched} {item.product?.uom || 'qty'})
                                  </span>
                                  {item.sc?.scNumber && (
                                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-200 font-mono font-medium">
                                      {item.sc.scNumber}
                                    </span>
                                  )}
                                </div>
                                {hasActivity && (
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-500">
                                    <span className="text-emerald-700 font-medium">P: {itemPassed}</span>
                                    {itemRejected > 0 && (
                                      <span className="text-rose-700 font-medium">R: {itemRejected}</span>
                                    )}
                                    {itemQc > 0 && (
                                      <span className="text-purple-700 font-medium">QC: {itemQc}</span>
                                    )}
                                    {itemVendor > 0 && (
                                      <span className="text-amber-700 font-medium">V: {itemVendor}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          {dc.items.length > 2 && (
                            <span className="text-[10px] text-slate-400 italic">
                              +{dc.items.length - 2} more item
                              {dc.items.length - 2 > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          No line items
                        </span>
                      )}
                    </td>

                    {/* Issue Date */}
                    <td className="px-6 py-3 tabular-nums text-slate-600 text-xs">
                      {dc.dispatchDate
                        ? new Date(dc.dispatchDate).toLocaleDateString()
                        : 'N/A'}
                    </td>

                    {/* Target Return & SLA */}
                    <td className="px-6 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-600 tabular-nums">
                          {dc.expectedReturnDate
                            ? new Date(
                                dc.expectedReturnDate
                              ).toLocaleDateString()
                            : 'N/A'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium w-fit ${sla.color}`}
                        >
                          <SlaIcon className="w-3 h-3" />
                          {sla.label}
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-3 text-right">
                      {stats.totalQcPending > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            onInspectQc ? onInspectQc(dc) : onSelect(dc)
                          }
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-md hover:bg-purple-700 transition-colors shadow-sm ring-1 ring-purple-700"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Inspect QC
                        </button>
                      ) : isClosed ? (
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
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    No delivery challans match your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
