import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Truck,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  X,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import { DataTable, type ColumnDef } from '../ui';
import { ExportDropdown } from '../common/ExportDropdown';
import type { ExportColumn } from '../../utils/exportUtils';

export function DcMovementsWorkspaceView() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'TYPE_1' | 'TYPE_2'>('ALL');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUTWARD' | 'INWARD'>('ALL');

  const {
    data: rawMovements = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['all-dc-movements'],
    queryFn: () => deliveryChallanApi.getAllMovements(),
    staleTime: 30000,
  });

  const filteredMovements = useMemo(() => {
    return (rawMovements as any[]).filter((m) => {
      // 1. Type filter
      if (typeFilter === 'TYPE_1' && m.challanType !== 'PRODUCTION_PROCESS_OUTWARD') return false;
      if (typeFilter === 'TYPE_2' && m.challanType !== 'GENERAL_INVENTORY_OUTWARD') return false;

      // 2. Direction filter
      if (directionFilter === 'OUTWARD' && m.direction !== 'OUTWARD') return false;
      if (directionFilter === 'INWARD' && m.direction !== 'INWARD') return false;

      // 3. Search filter
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;

      const tokens = q.split(/\s+/).filter(Boolean);
      const matchField = (fieldVal?: string | null) => {
        if (!fieldVal) return false;
        const val = fieldVal.toLowerCase();
        if (val.includes(q)) return true;
        return tokens.some((t) => {
          if (val.includes(t)) return true;
          if (t.endsWith('ing') && t.length > 4 && val.includes(t.slice(0, -3))) return true;
          if (t.endsWith('ed') && t.length > 4 && val.includes(t.slice(0, -2))) return true;
          if (t === 'heating' && (val.includes('heat') || val.includes('ht'))) return true;
          if (t === 'ht' && val.includes('heat')) return true;
          return false;
        });
      };

      return (
        matchField(m.challanNumber) ||
        matchField(m.vendorName) ||
        matchField(m.vendorCode) ||
        matchField(m.scNumber) ||
        matchField(m.partNumber) ||
        matchField(m.partName) ||
        matchField(m.productName) ||
        matchField(m.productCode) ||
        matchField(m.processName) ||
        matchField(m.notes) ||
        matchField(m.location) ||
        matchField(m.status)
      );
    });
  }, [rawMovements, typeFilter, directionFilter, searchTerm]);

  // Aggregate metrics
  const stats = useMemo(() => {
    let outwardCount = 0;
    let inwardCount = 0;
    (rawMovements as any[]).forEach((m) => {
      if (m.direction === 'OUTWARD') outwardCount += 1;
      if (m.direction === 'INWARD') inwardCount += 1;
    });
    return {
      total: (rawMovements as any[]).length,
      outwardCount,
      inwardCount,
    };
  }, [rawMovements]);

  const columns: ColumnDef<any>[] = [
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
          <span className="font-mono text-xs font-bold text-primary">
            {row.challanNumber}
          </span>
          <span className="text-[10px] text-slate-400">
            {row.challanTypeLabel}
          </span>
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
            {isOutward ? (
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
            )}
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
          <span className="font-medium text-slate-800 text-xs truncate max-w-44">
            {row.vendorName}
          </span>
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
            <span className="text-[10px] text-slate-500 truncate max-w-40 font-medium">
              {row.partName}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'productName',
      header: 'Material / Product',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 text-xs">{row.productName}</p>
          {row.productCode && (
            <p className="text-[10px] font-mono text-slate-500">{row.productCode}</p>
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

  const exportColumns: ExportColumn<any>[] = [
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
    { header: 'Vendor / Subcontractor', accessor: (row) => row.vendorName || '' },
    {
      header: 'SC / Part No.',
      accessor: (row) => (row.partNumber !== '—' ? row.partNumber : row.scNumber || ''),
    },
    { header: 'Material / Product', accessor: (row) => row.productName || '' },
    { header: 'Product Code', accessor: (row) => row.productCode || '' },
    {
      header: 'Qty Movement',
      isNumeric: true,
      accessor: (row) =>
        `${row.direction === 'OUTWARD' ? '-' : '+'}${Math.abs(
          Number(row.rawQuantity || row.quantity)
        ).toFixed(3)} ${row.uom || ''}`,
    },
    { header: 'Stage / Bin', accessor: (row) => row.location || '' },
    { header: 'Status', accessor: (row) => (row.status || '').replace('_', ' ') },
  ];

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-[#8896ab] truncate">Total DC Movements</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white truncate">{stats.total}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-[#8896ab] truncate">Outward (Dispatched)</div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400 truncate">{stats.outwardCount}</div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-500 dark:text-[#8896ab] truncate">Inward (Returned)</div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400 truncate">{stats.inwardCount}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1e233d] rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Part #, Product Name, Vendor, Process Type, DC #, Bin..."
              className="w-full pl-10 pr-9 h-11 bg-slate-50 dark:bg-[#0e111f] border border-slate-200 dark:border-[#1e233d] rounded-xl text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white dark:focus:bg-[#121526] transition-all font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
            <ExportDropdown
              data={filteredMovements}
              columns={exportColumns}
              fileName="DC_Movements"
              reportTitle="Delivery Challan Movements Ledger"
              reportSubtitle={`Showing ${filteredMovements.length} movements`}
              metadata={{
                'Total Movements': filteredMovements.length,
                'DC Type Filter': typeFilter,
                'Direction Filter': directionFilter,
                Search: searchTerm || 'All',
              }}
            />
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="min-h-[44px] h-11 px-3.5 inline-flex items-center gap-1.5 border border-slate-200 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] hover:bg-slate-50 dark:hover:bg-[#161a2e] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100 dark:border-[#1e233d] text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8896ab] font-semibold mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* DC Type Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e111f] p-1 rounded-xl border border-slate-200 dark:border-[#1e233d] overflow-x-auto touch-pan-x">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === 'ALL'
                    ? 'bg-white dark:bg-[#1e233d] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All DC Types
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('TYPE_1')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === 'TYPE_1'
                    ? 'bg-white dark:bg-[#1e233d] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Type 1 (Process)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('TYPE_2')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  typeFilter === 'TYPE_2'
                    ? 'bg-white dark:bg-[#1e233d] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Type 2 (Stock)
              </button>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0e111f] p-1 rounded-xl border border-slate-200 dark:border-[#1e233d] overflow-x-auto touch-pan-x">
              <button
                type="button"
                onClick={() => setDirectionFilter('ALL')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  directionFilter === 'ALL'
                    ? 'bg-white dark:bg-[#1e233d] text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('OUTWARD')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  directionFilter === 'OUTWARD'
                    ? 'bg-white dark:bg-[#1e233d] text-amber-800 dark:text-amber-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                Outward
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('INWARD')}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  directionFilter === 'INWARD'
                    ? 'bg-white dark:bg-[#1e233d] text-emerald-800 dark:text-emerald-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                Inward
              </button>
            </div>
          </div>

          {/* Counts pill */}
          <div className="flex items-center gap-2 text-slate-500 dark:text-[#8896ab] font-medium text-xs">
            <span>
              Showing <strong className="text-slate-900 dark:text-white">{filteredMovements.length}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white">{(rawMovements as any[]).length}</strong> movements
            </span>
          </div>
        </div>
      </div>

      {/* Movement Ledger Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <DataTable
          data={filteredMovements}
          columns={columns}
          isLoading={isLoading}
          pagination
          defaultPageSize={20}
        />
      </div>
    </div>
  );
}
