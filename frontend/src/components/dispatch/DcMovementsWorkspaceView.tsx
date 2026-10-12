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

  return (
    <div className="space-y-4">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Total DC Movements</div>
            <div className="text-xl font-bold text-slate-900">{stats.total}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Outward (Dispatched)</div>
            <div className="text-xl font-bold text-amber-700">{stats.outwardCount}</div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500">Inward (Returned)</div>
            <div className="text-xl font-bold text-emerald-700">{stats.inwardCount}</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Part #, Product Name, Vendor, Process Type (e.g. Heating), DC #, Bin..."
              className="w-full pl-9 pr-9 h-10 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-all font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-10 px-3.5 inline-flex items-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* DC Type Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  typeFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All DC Types
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('TYPE_1')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  typeFilter === 'TYPE_1'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Type 1 (Process)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('TYPE_2')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  typeFilter === 'TYPE_2'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Type 2 (Stock Conversion)
              </button>
            </div>

            {/* Direction Filter */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setDirectionFilter('ALL')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                  directionFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Movements
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('OUTWARD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1 ${
                  directionFilter === 'OUTWARD'
                    ? 'bg-white text-amber-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
                Outward (Dispatches)
              </button>
              <button
                type="button"
                onClick={() => setDirectionFilter('INWARD')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors inline-flex items-center gap-1 ${
                  directionFilter === 'INWARD'
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                Inward (Returns)
              </button>
            </div>
          </div>

          {/* Counts pill */}
          <div className="flex items-center gap-2 text-slate-500 font-medium">
            <span>
              Showing <strong className="text-slate-900">{filteredMovements.length}</strong> of{' '}
              <strong className="text-slate-900">{(rawMovements as any[]).length}</strong> movements
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
