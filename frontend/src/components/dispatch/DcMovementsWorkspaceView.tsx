import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  X,
  Building2,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import { vendorMasterApi } from '../../services/vendorMaster.service';
import { DataTable, type ColumnDef, MultiSelectFilter } from '../ui';
import { ExportDropdown } from '../common/ExportDropdown';
import type { ExportColumn } from '../../utils/exportUtils';
import type { DcComprehensiveLifecycleItemDto } from '../../types/delivery-challan.dto';

export function DcMovementsWorkspaceView() {
  const [activeTab, setActiveTab] = useState<'REPORT' | 'LEDGER'>('REPORT');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCTION_PROCESS_OUTWARD' | 'GENERAL_INVENTORY_OUTWARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUTWARD' | 'INWARD'>('ALL');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reworkOnly, setReworkOnly] = useState<boolean>(false);

  // 1. Fetch Comprehensive Lifecycle Audit Report
  const {
    data: lifecycleData,
    isLoading: isReportLoading,
    refetch: refetchReport,
    isRefetching: isReportRefetching,
  } = useQuery({
    queryKey: ['dc-lifecycle-report', typeFilter, statusFilter, startDate, endDate, reworkOnly],
    queryFn: () =>
      deliveryChallanApi.getLifecycleReport({
        type: typeFilter,
        status: statusFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        reworkOnly,
      }),
    staleTime: 30000,
  });

  // 2. Fetch Granular Ledger Movements
  const {
    data: rawMovements = [],
    isLoading: isMovementsLoading,
    refetch: refetchMovements,
    isRefetching: isMovementsRefetching,
  } = useQuery({
    queryKey: ['all-dc-movements'],
    queryFn: () => deliveryChallanApi.getAllMovements(),
    staleTime: 30000,
  });

  // 3. Fetch Master Vendors for Filter
  const { data: allVendors = [] } = useQuery({
    queryKey: ['all-vendors-master'],
    queryFn: () => vendorMasterApi.getAll({ isActive: true }),
    staleTime: 60000,
  });

  const vendorOptions = useMemo(() => {
    return (allVendors as any[]).map((v) => ({
      id: v.id,
      label: `${v.code || ''} – ${v.name}`,
    }));
  }, [allVendors]);

  // Comprehensive Report Items filtered locally by Vendor & Search Term
  const filteredReportItems = useMemo(() => {
    const rawItems: any[] = lifecycleData?.items || [];
    const items: DcComprehensiveLifecycleItemDto[] = rawItems.map((row) => ({
      ...row,
      id: row.id || row.rowId,
    }));
    return items.filter((row) => {
      // Vendor filter
      if (selectedVendors.length > 0) {
        if (!selectedVendors.includes(row.vendorId)) return false;
      }

      // Search term filter
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;

      const tokens = q.split(/\s+/).filter(Boolean);
      const matchField = (fieldVal?: string | null) => {
        if (!fieldVal) return false;
        const val = fieldVal.toLowerCase();
        if (val.includes(q)) return true;
        return tokens.some((t) => val.includes(t));
      };

      return (
        matchField(row.challanNumber) ||
        matchField(row.vendorName) ||
        matchField(row.vendorCode) ||
        matchField(row.partNumber) ||
        matchField(row.partName) ||
        matchField(row.productName) ||
        matchField(row.productCode) ||
        matchField(row.scNumber) ||
        matchField(row.processName) ||
        matchField(row.reworkSummary) ||
        matchField(row.deliveryTurnaround) ||
        matchField(row.status) ||
        matchField(row.notes)
      );
    });
  }, [lifecycleData, selectedVendors, searchTerm]);

  // Movements Ledger Filtered Items
  const filteredMovements = useMemo(() => {
    return (rawMovements as any[]).filter((m) => {
      if (typeFilter !== 'ALL' && m.challanType !== typeFilter) return false;
      if (directionFilter === 'OUTWARD' && m.direction !== 'OUTWARD') return false;
      if (directionFilter === 'INWARD' && m.direction !== 'INWARD') return false;
      if (selectedVendors.length > 0 && !selectedVendors.includes(m.vendorId)) return false;
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;

      const matchField = (fieldVal?: string | null) => {
        if (!fieldVal) return false;
        return fieldVal.toLowerCase().includes(q);
      };

      return (
        matchField(m.challanNumber) ||
        matchField(m.vendorName) ||
        matchField(m.partNumber) ||
        matchField(m.partName) ||
        matchField(m.productName) ||
        matchField(m.processName) ||
        matchField(m.reworkSummary) ||
        matchField(m.status)
      );
    });
  }, [rawMovements, typeFilter, directionFilter, selectedVendors, statusFilter, searchTerm]);

  // Aggregate Report KPIs
  const reportKpis = useMemo(() => {
    if (lifecycleData?.kpis) {
      return lifecycleData.kpis;
    }
    return {
      totalChallans: 0,
      totalDispatchedUnits: 0,
      totalReceivedUnits: 0,
      totalVariationUnits: 0,
      totalQcPendingUnits: 0,
      totalReworkUnits: 0,
      onTimeRate: 100,
      totalReceiptsCount: 0,
      onTimeReceiptCount: 0,
    };
  }, [lifecycleData]);

  // Reset all filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setStatusFilter('ALL');
    setDirectionFilter('ALL');
    setSelectedVendors([]);
    setStartDate('');
    setEndDate('');
    setReworkOnly(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Report Columns
  // ─────────────────────────────────────────────────────────────────────────────
  const reportColumns: ColumnDef<DcComprehensiveLifecycleItemDto>[] = [
    {
      key: 'challanNumber',
      header: 'DC Number & Type',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-primary">{row.challanNumber}</span>
          <span className="text-[10px] text-slate-500 font-medium">{row.typeLabel}</span>
          {row.scNumber && row.scNumber !== '—' && (
            <span className="text-[10px] font-mono text-blue-600">SC: {row.scNumber}</span>
          )}
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Vendor / Subcontractor',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <div>
            <p className="font-medium text-slate-900 text-xs truncate max-w-44">{row.vendorName}</p>
            {row.vendorCode && <p className="text-[10px] font-mono text-slate-400">{row.vendorCode}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'material',
      header: 'Material / Part No.',
      render: (row) => (
        <div className="flex flex-col max-w-44">
          <span className="font-mono text-xs font-semibold text-slate-800 truncate">
            {row.partNumber !== '—' ? row.partNumber : row.productCode || row.productName}
          </span>
          <span className="text-[11px] text-slate-500 truncate" title={row.partName || row.productName}>
            {row.partName || row.productName}
          </span>
          {row.processName && (
            <span className="text-[10px] text-slate-400 truncate font-medium">Proc: {row.processName}</span>
          )}
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Sent & Estimated Delivery',
      render: (row) => (
        <div className="flex flex-col text-xs font-medium space-y-0.5">
          <div className="flex items-center gap-1 text-slate-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Sent:</span>
            <span>{row.dispatchDateFormatted}</span>
          </div>
          <div className="flex items-center gap-1 text-blue-700">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Est:</span>
            <span>{row.expectedReturnDateFormatted}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'receipt',
      header: 'Actual Receipt & SLA',
      render: (row) => (
        <div className="flex flex-col text-xs">
          {row.actualReturnDate ? (
            <>
              <div className="flex items-center gap-1 font-semibold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{row.actualReturnDateFormatted}</span>
              </div>
              <span className={`text-[10px] font-medium mt-0.5 ${row.isOnTime ? 'text-emerald-700' : 'text-amber-700'}`}>
                {row.deliveryTurnaround}
              </span>
            </>
          ) : (
            <div className="flex flex-col">
              <span className="text-xs text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block w-fit">
                Pending Receipt
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">{row.deliveryTurnaround}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'quantities',
      header: 'Expected vs Revised',
      isNumeric: true,
      render: (row) => (
        <div className="flex flex-col text-right font-mono text-xs tabular-nums">
          <div className="text-slate-500 text-[11px]">
            Init: <strong className="text-slate-800">{row.initialExpectedQty}</strong> {row.uom}
          </div>
          <div className="text-blue-900 font-bold">
            Rev: <strong>{row.revisedExpectedQty}</strong> {row.uom}
          </div>
        </div>
      ),
    },
    {
      key: 'variation',
      header: 'Variation (Yield Diff)',
      isNumeric: true,
      render: (row) => (
        <div className="flex flex-col items-end">
          {row.hasVariation ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Var: -{row.expectedVariation} {row.uom}
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">0 (100% Target)</span>
          )}
          <span className="text-[10px] text-slate-400 mt-0.5">Not partial balance</span>
        </div>
      ),
    },
    {
      key: 'inwardReceived',
      header: 'Actual Received (QC)',
      isNumeric: true,
      render: (row) => (
        <div className="flex flex-col items-end text-xs font-mono tabular-nums">
          <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Rec: {row.actualReceivedQty} {row.uom}
          </span>
          {row.unreceivedBalance > 0 ? (
            <span className="text-[10px] text-amber-700 font-medium mt-0.5">
              {row.unreceivedBalance} at vendor
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 font-medium mt-0.5">Fully inwarded</span>
          )}
        </div>
      ),
    },
    {
      key: 'qcRework',
      header: 'QC Result & Rework Loop',
      render: (row) => (
        <div className="flex flex-col text-xs max-w-56">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-700">Pass: {row.qcPassedQty}</span>
            {row.qcRejectedQty > 0 && (
              <span className="font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                Rej: {row.qcRejectedQty}
              </span>
            )}
            {row.qcPendingQty > 0 && (
              <span className="font-medium text-amber-700">In QC: {row.qcPendingQty}</span>
            )}
          </div>
          {row.reworkEntries && row.reworkEntries.length > 0 ? (
            <div className="mt-1 pt-1 border-t border-slate-100 space-y-1">
              {row.reworkEntries.map((rw, i) => (
                <div key={i} className="text-[10px] text-slate-700 bg-slate-50 p-1 rounded border border-slate-200">
                  <div className="flex items-center gap-1 font-semibold text-amber-800">
                    <RotateCcw className="w-3 h-3 text-amber-600 shrink-0" />
                    <span>{rw.isSameVendor ? 'Same Vendor' : 'New Vendor'} Rework</span>
                    {rw.reworkDcNumber && <span className="font-mono text-primary font-bold">({rw.reworkDcNumber})</span>}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">{rw.summary}</p>
                </div>
              ))}
            </div>
          ) : row.qcRejectedQty > 0 ? (
            <span className="text-[10px] text-rose-600 font-medium mt-0.5">Defective units pending rework dispatch</span>
          ) : (
            <span className="text-[10px] text-slate-400 mt-0.5">No QC defects</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isClosed = row.status === 'CLOSED' || row.status === 'RETURNED';
        const isPartial = row.status === 'PARTIALLY_RETURNED';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
              isClosed
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isPartial
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {isClosed && <CheckCircle2 className="w-3 h-3 text-emerald-600 mr-1" />}
            {row.status.replace('_', ' ')}
          </span>
        );
      },
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // Report Export Columns (Excel / CSV)
  // ─────────────────────────────────────────────────────────────────────────────
  const exportReportColumns: ExportColumn<DcComprehensiveLifecycleItemDto>[] = [
    { header: 'DC Number', accessor: (r) => r.challanNumber },
    { header: 'DC Type', accessor: (r) => r.typeLabel },
    { header: 'Vendor Name', accessor: (r) => r.vendorName },
    { header: 'Vendor Code', accessor: (r) => r.vendorCode },
    { header: 'SC Number', accessor: (r) => r.scNumber },
    { header: 'Process', accessor: (r) => r.processName },
    { header: 'Part Number', accessor: (r) => r.partNumber },
    { header: 'Part / Product Name', accessor: (r) => r.partName || r.productName },
    { header: 'Unit of Measure', accessor: (r) => r.uom },
    { header: 'Dispatch Date', accessor: (r) => r.dispatchDateFormatted },
    { header: 'Estimated Delivery Date', accessor: (r) => r.expectedReturnDateFormatted },
    { header: 'Actual Receipt Date', accessor: (r) => r.actualReturnDateFormatted },
    { header: 'Delivery SLA / Turnaround', accessor: (r) => r.deliveryTurnaround },
    { header: 'Initial Expected Qty', isNumeric: true, accessor: (r) => r.initialExpectedQty },
    { header: 'Revised Expected Qty on Receipt', isNumeric: true, accessor: (r) => r.revisedExpectedQty },
    { header: 'Expected Variation (Yield)', isNumeric: true, accessor: (r) => r.expectedVariation },
    { header: 'Actual Received Qty (to QC)', isNumeric: true, accessor: (r) => r.actualReceivedQty },
    { header: 'Remaining Balance at Vendor', isNumeric: true, accessor: (r) => r.unreceivedBalance },
    { header: 'QC Passed Qty', isNumeric: true, accessor: (r) => r.qcPassedQty },
    { header: 'QC Rejected / Rework Qty', isNumeric: true, accessor: (r) => r.qcRejectedQty },
    { header: 'QC Pending Qty', isNumeric: true, accessor: (r) => r.qcPendingQty },
    { header: 'Rework Details', accessor: (r) => r.reworkSummary },
    { header: 'Overall Status', accessor: (r) => r.status.replace('_', ' ') },
    { header: 'Notes', accessor: (r) => r.notes },
  ];

  // ─────────────────────────────────────────────────────────────────────────────
  // Ledger Columns (Existing granular table)
  // ─────────────────────────────────────────────────────────────────────────────
  const ledgerColumns: ColumnDef<any>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
          {row.date ? new Date(row.date).toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) : '—'}
        </span>
      ),
    },
    {
      key: 'challanNumber',
      header: 'DC Number',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold text-primary">{row.challanNumber}</span>
          <span className="text-[10px] text-slate-400">{row.challanTypeLabel}</span>
        </div>
      ),
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (row) => {
        const isOutward = row.direction === 'OUTWARD';
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border shadow-2xs ${
              isOutward
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}
          >
            {isOutward ? <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />}
            {row.direction}
          </span>
        );
      },
    },
    {
      key: 'vendorName',
      header: 'Vendor / Subcontractor',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="font-medium text-slate-800 text-xs truncate max-w-44">{row.vendorName}</span>
        </div>
      ),
    },
    {
      key: 'partNumber',
      header: 'SC / Part No.',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs font-semibold text-slate-700">
            {row.partNumber !== '—' ? row.partNumber : row.scNumber}
          </span>
          {row.partName && row.partName !== row.productName && (
            <span className="text-[10px] text-slate-500 truncate max-w-40 font-medium">{row.partName}</span>
          )}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty Movement',
      isNumeric: true,
      render: (row) => {
        const isOutward = row.direction === 'OUTWARD';
        return (
          <span
            className={`font-mono text-xs font-bold tabular-nums ${
              isOutward ? 'text-amber-700' : 'text-emerald-700'
            }`}
          >
            {isOutward ? '-' : '+'}
            {Math.abs(Number(row.rawQuantity || row.quantity)).toFixed(3)} {row.uom}
          </span>
        );
      },
    },
    {
      key: 'variation',
      header: 'Expected Variation',
      isNumeric: true,
      render: (row) =>
        row.expectedVariation > 0 ? (
          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
            -{row.expectedVariation}
          </span>
        ) : (
          <span className="text-xs text-slate-400 font-medium">0</span>
        ),
    },
    {
      key: 'location',
      header: 'Stage / Bin',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {row.location}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const isRet = row.status === 'RETURNED' || row.status === 'CLOSED';
        const isPart = row.status === 'PARTIALLY_RETURNED';
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
              isRet
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isPart
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}
          >
            {isRet && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
            {row.status.replace('_', ' ')}
          </span>
        );
      },
    },
  ];

  const exportLedgerColumns: ExportColumn<any>[] = [
    {
      header: 'Date',
      accessor: (row) =>
        row.date
          ? new Date(row.date).toLocaleString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    { header: 'DC Number', accessor: (row) => row.challanNumber || '' },
    { header: 'DC Type', accessor: (row) => row.challanTypeLabel || '' },
    { header: 'Direction', accessor: (row) => row.direction || '' },
    { header: 'Vendor', accessor: (row) => row.vendorName || '' },
    { header: 'SC / Part No.', accessor: (row) => (row.partNumber !== '—' ? row.partNumber : row.scNumber || '') },
    { header: 'Material / Product', accessor: (row) => row.productName || '' },
    {
      header: 'Qty Movement',
      isNumeric: true,
      accessor: (row) =>
        `${row.direction === 'OUTWARD' ? '-' : '+'}${Math.abs(Number(row.rawQuantity || row.quantity)).toFixed(3)} ${row.uom || ''}`,
    },
    { header: 'Expected Variation', isNumeric: true, accessor: (row) => row.expectedVariation || 0 },
    { header: 'QC Passed', isNumeric: true, accessor: (row) => row.qcPassedQty || 0 },
    { header: 'QC Rejected', isNumeric: true, accessor: (row) => row.qcRejectedQty || 0 },
    { header: 'Rework Details', accessor: (row) => row.reworkSummary || '' },
    { header: 'Stage / Location', accessor: (row) => row.location || '' },
    { header: 'Status', accessor: (row) => (row.status || '').replace('_', ' ') },
  ];

  return (
    <div className="space-y-5">
      {/* View Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('REPORT')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'REPORT'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span>DC Comprehensive Audit Report</span>
            <span className="ml-1 px-1.5 py-0.2 bg-primary/10 text-primary text-[10px] rounded-full">
              {filteredReportItems.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LEDGER')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'LEDGER'
                ? 'bg-white text-primary shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>Movements Ledger Stream</span>
            <span className="ml-1 px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full">
              {filteredMovements.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'REPORT' ? (
            <ExportDropdown
              data={filteredReportItems}
              columns={exportReportColumns}
              fileName="DC_Comprehensive_Audit_Report"
              reportTitle="Delivery Challan Inward/Outward Audit & Lifecycle Report"
              reportSubtitle={`Generated for ${filteredReportItems.length} entries across Type 1 & Type 2 DCs`}
              metadata={{
                'Total Entries': filteredReportItems.length,
                'DC Type Filter': typeFilter,
                'Status Filter': statusFilter,
                'Search Filter': searchTerm || 'None',
              }}
            />
          ) : (
            <ExportDropdown
              data={filteredMovements}
              columns={exportLedgerColumns}
              fileName="DC_Movements_Ledger"
              reportTitle="Delivery Challan Movements Ledger"
              reportSubtitle={`Showing ${filteredMovements.length} movements`}
              metadata={{
                'Total Movements': filteredMovements.length,
                'DC Type Filter': typeFilter,
                'Direction Filter': directionFilter,
              }}
            />
          )}

          <button
            type="button"
            onClick={() => {
              if (activeTab === 'REPORT') refetchReport();
              else refetchMovements();
            }}
            disabled={isReportRefetching || isMovementsRefetching}
            className="min-h-[40px] h-10 px-3.5 inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            title="Refresh data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${(activeTab === 'REPORT' ? isReportRefetching : isMovementsRefetching) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Dispatched Qty</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{reportKpis.totalDispatchedUnits}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Total Outward Sent</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Received Qty</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{reportKpis.totalReceivedUnits}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Dock Inwarded to QC</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Yield Variation</span>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1">-{reportKpis.totalVariationUnits}</div>
          <div className="text-[10px] text-amber-600 mt-0.5">Expected Reduction</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">In QC Inspection</div>
          <div className="text-xl font-bold text-blue-700 mt-1">{reportKpis.totalQcPendingUnits}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">Pending Split Verdict</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-rose-800 uppercase tracking-wider flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
            <span>Rework Units</span>
          </div>
          <div className="text-xl font-bold text-rose-700 mt-1">{reportKpis.totalReworkUnits}</div>
          <div className="text-[10px] text-rose-600 mt-0.5">Same vs New Vendor</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">On-Time Delivery</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{reportKpis.onTimeRate}%</div>
          <div className="text-[10px] text-slate-400 mt-0.5">{reportKpis.onTimeReceiptCount || 0} of {reportKpis.totalReceiptsCount || 0} receipts</div>
        </div>
      </div>

      {/* Filter Toolbar ("Takes the report on all the bases") */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by DC #, Vendor, Part #, SC #, Material Name, Rework DC #, Turnaround..."
              className="w-full pl-10 pr-9 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] text-slate-500 uppercase font-semibold">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Filter Badges and Selectors */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* DC Type Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Types
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('PRODUCTION_PROCESS_OUTWARD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  typeFilter === 'PRODUCTION_PROCESS_OUTWARD' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Type 1 (Process)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('GENERAL_INVENTORY_OUTWARD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  typeFilter === 'GENERAL_INVENTORY_OUTWARD' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Type 2 (Stock)
              </button>
            </div>

            {/* Vendor Multi-Select Filter */}
            <MultiSelectFilter
              label="Vendors"
              placeholder="Filter by Vendors..."
              options={vendorOptions}
              selectedValues={selectedVendors}
              onChange={setSelectedVendors}
            />

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="DISPATCHED">Dispatched (Open)</option>
              <option value="PARTIALLY_RETURNED">Partially Returned</option>
              <option value="RETURNED">Returned</option>
              <option value="CLOSED">Closed</option>
            </select>

            {/* Direction Filter (when on ledger tab) */}
            {activeTab === 'LEDGER' && (
              <select
                value={directionFilter}
                onChange={(e) => setDirectionFilter(e.target.value as any)}
                className="h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Directions</option>
                <option value="OUTWARD">Outward Sent</option>
                <option value="INWARD">Inward Received</option>
              </select>
            )}

            {/* Rework Only Toggle */}
            <button
              type="button"
              onClick={() => setReworkOnly(!reworkOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                reworkOnly
                  ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <RotateCcw className={`w-3.5 h-3.5 ${reworkOnly ? 'text-rose-600' : 'text-slate-400'}`} />
              <span>Rework Items Only</span>
            </button>

            {/* Reset Filters */}
            {(searchTerm || typeFilter !== 'ALL' || statusFilter !== 'ALL' || selectedVendors.length > 0 || startDate || endDate || reworkOnly) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                Reset All Filters
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{activeTab === 'REPORT' ? filteredReportItems.length : filteredMovements.length}</strong> matching rows
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        {activeTab === 'REPORT' ? (
          <div>
            <DataTable
              data={filteredReportItems}
              columns={reportColumns}
              isLoading={isReportLoading}
              pagination
              defaultPageSize={15}
            />
          </div>
        ) : (
          <div>
            <DataTable
              data={filteredMovements}
              columns={ledgerColumns}
              isLoading={isMovementsLoading}
              pagination
              defaultPageSize={20}
            />
          </div>
        )}
      </div>
    </div>
  );
}
