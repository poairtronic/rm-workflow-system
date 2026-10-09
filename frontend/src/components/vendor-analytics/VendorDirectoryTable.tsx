import { useState, useMemo } from 'react';
import { 
  Search, 
  Building2, 
  Package, 
  Clock, 
  AlertTriangle, 
  ChevronRight,
  SlidersHorizontal,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import type { VendorPerformanceRankingItemDto } from '../../types/vendor-analytics.dto';
import type { VendorMasterDto } from '../../types/vendor-master.dto';
import type { VendorSlaDto } from '../../types/vendor-sla.dto';

interface VendorDirectoryTableProps {
  rankings: VendorPerformanceRankingItemDto[];
  vendorsMaster: VendorMasterDto[];
  slas: VendorSlaDto[];
  onSelectVendor: (vendorId: string) => void;
}

type FilterTab = 'ALL' | 'WITH_CUSTODY' | 'WITH_OVERDUE' | 'HIGH_SLA' | 'NEEDS_ATTENTION';

export function VendorDirectoryTable({
  rankings = [],
  vendorsMaster = [],
  slas = [],
  onSelectVendor,
}: VendorDirectoryTableProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Build lookup maps for fast access
  const rankingMap = useMemo(() => {
    const map = new Map<string, VendorPerformanceRankingItemDto>();
    rankings.forEach((r) => map.set(r.vendorId, r));
    return map;
  }, [rankings]);

  const slaCountMap = useMemo(() => {
    const map = new Map<string, number>();
    slas.forEach((s) => {
      if (s.isActive) {
        map.set(s.vendorId, (map.get(s.vendorId) || 0) + 1);
      }
    });
    return map;
  }, [slas]);

  // Combine master vendors with their performance metrics
  const combinedVendors = useMemo(() => {
    return vendorsMaster.map((v) => {
      const perf = rankingMap.get(v.id);
      const slaCount = slaCountMap.get(v.id) || 0;
      return {
        id: v.id,
        code: v.code,
        name: v.name,
        category: v.category || 'General Vendor',
        contactPerson: v.contactPerson || '—',
        phone: v.phone || '—',
        email: v.email || '—',
        isActive: v.isActive,
        totalDcs: perf?.totalDcs ?? 0,
        openDcs: perf?.openDcs ?? 0,
        closedDcs: perf?.closedDcs ?? 0,
        overdueDcs: perf?.overdueDcs ?? 0,
        slaComplianceRate: perf?.slaComplianceRate ?? 100,
        avgTurnaroundDays: perf?.avgTurnaroundDays ?? 0,
        activeItemsInCustody: perf?.activeItemsInCustody ?? 0,
        slaCount,
      };
    });
  }, [vendorsMaster, rankingMap, slaCountMap]);

  // Unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    vendorsMaster.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return Array.from(set).sort();
  }, [vendorsMaster]);

  // Filter and search
  const filteredVendors = useMemo(() => {
    const query = search.toLowerCase().trim();
    return combinedVendors.filter((v) => {
      // Tab filter
      if (activeTab === 'WITH_CUSTODY' && v.activeItemsInCustody <= 0) return false;
      if (activeTab === 'WITH_OVERDUE' && v.overdueDcs <= 0) return false;
      if (activeTab === 'HIGH_SLA' && v.slaComplianceRate < 90) return false;
      if (activeTab === 'NEEDS_ATTENTION' && (v.overdueDcs > 0 || v.slaComplianceRate < 90) === false) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && v.category !== selectedCategory) return false;

      // Text search
      if (!query) return true;
      return (
        v.name.toLowerCase().includes(query) ||
        v.code.toLowerCase().includes(query) ||
        v.category.toLowerCase().includes(query) ||
        v.contactPerson.toLowerCase().includes(query) ||
        v.phone.toLowerCase().includes(query) ||
        v.email.toLowerCase().includes(query)
      );
    });
  }, [combinedVendors, search, activeTab, selectedCategory]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: combinedVendors.length,
      withCustody: combinedVendors.filter((v) => v.activeItemsInCustody > 0).length,
      withOverdue: combinedVendors.filter((v) => v.overdueDcs > 0).length,
      highSla: combinedVendors.filter((v) => v.slaComplianceRate >= 90).length,
      needsAttention: combinedVendors.filter((v) => v.overdueDcs > 0 || v.slaComplianceRate < 90).length,
    };
  }, [combinedVendors]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-8">
      {/* Table Header & Controls */}
      <div className="p-6 border-b border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Vendor Performance Directory & Custody Ledger
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Complete oversight of all {combinedVendors.length} registered manufacturing vendors, SLA metrics, and active custody
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search vendor name, code, contact..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Tab Filters & Category Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'ALL'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Vendors ({tabCounts.all})
            </button>
            <button
              onClick={() => setActiveTab('WITH_CUSTODY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'WITH_CUSTODY'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Active In Custody ({tabCounts.withCustody})
            </button>
            <button
              onClick={() => setActiveTab('WITH_OVERDUE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'WITH_OVERDUE'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Overdue Dispatches ({tabCounts.withOverdue})
            </button>
            <button
              onClick={() => setActiveTab('HIGH_SLA')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'HIGH_SLA'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              High SLA ≥90% ({tabCounts.highSla})
            </button>
          </div>

          {/* Category Dropdown */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Directory Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-3.5">Vendor</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5">Contact Info</th>
              <th className="px-6 py-3.5 text-center">Status</th>
              <th className="px-6 py-3.5 text-center">Configured SLAs</th>
              <th className="px-6 py-3.5 text-right">Items in Custody</th>
              <th className="px-6 py-3.5 text-center">DC Breakdown</th>
              <th className="px-6 py-3.5 text-center">SLA Compliance</th>
              <th className="px-6 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredVendors.map((v) => {
              const isHighSla = v.slaComplianceRate >= 90;
              const hasCustody = v.activeItemsInCustody > 0;
              const hasOverdue = v.overdueDcs > 0;

              return (
                <tr
                  key={v.id}
                  onClick={() => onSelectVendor(v.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Vendor Code & Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {v.code}
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                          {v.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-6 py-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {v.category}
                    </span>
                  </td>

                  {/* Contact Info */}
                  <td className="px-6 py-4 text-xs text-slate-600">
                    <p className="font-medium text-slate-800">{v.contactPerson}</p>
                    <p className="text-slate-400 mt-0.5">{v.phone}</p>
                  </td>

                  {/* Active Status */}
                  <td className="px-6 py-4 text-center">
                    {v.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        <XCircle className="w-3 h-3 text-slate-400" /> Inactive
                      </span>
                    )}
                  </td>

                  {/* Configured SLAs */}
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        v.slaCount > 0
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}
                    >
                      {v.slaCount} {v.slaCount === 1 ? 'Process' : 'Processes'}
                    </span>
                  </td>

                  {/* Items in Custody */}
                  <td className="px-6 py-4 text-right">
                    {hasCustody ? (
                      <div>
                        <span className="font-bold text-blue-700 tabular-nums text-sm">
                          {v.activeItemsInCustody} units
                        </span>
                        <p className="text-[11px] text-slate-400">{v.openDcs} open DCs</p>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">0 units</span>
                    )}
                  </td>

                  {/* DC Breakdown */}
                  <td className="px-6 py-4 text-center text-xs">
                    <div className="inline-flex items-center gap-2">
                      <span title="Open DCs" className="font-semibold text-slate-700">
                        {v.openDcs} Open
                      </span>
                      <span className="text-slate-300">/</span>
                      <span title="Closed DCs" className="text-slate-500">
                        {v.closedDcs} Closed
                      </span>
                      {hasOverdue && (
                        <>
                          <span className="text-slate-300">/</span>
                          <span
                            title="Overdue DCs"
                            className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200"
                          >
                            {v.overdueDcs} Overdue
                          </span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* SLA Compliance */}
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span
                        className={`font-bold tabular-nums text-xs px-2.5 py-0.5 rounded-full border ${
                          isHighSla
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {v.slaComplianceRate.toFixed(1)}%
                      </span>
                      {v.avgTurnaroundDays > 0 && (
                        <span className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" /> {v.avgTurnaroundDays}d avg
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Action */}
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVendor(v.id);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-primary hover:text-white hover:border-primary transition-all shadow-sm"
                    >
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredVendors.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                  <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">No vendors matching search criteria</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing the search or resetting active filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-slate-50/60 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
        <span>
          Showing <strong>{filteredVendors.length}</strong> of <strong>{combinedVendors.length}</strong> total vendors
        </span>
        <span className="text-slate-400">
          Click any vendor row to inspect full custody ledger, active DCs, and process SLAs
        </span>
      </div>
    </div>
  );
}
