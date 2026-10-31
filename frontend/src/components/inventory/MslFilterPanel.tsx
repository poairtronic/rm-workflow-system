import React from 'react';
import { Search, Filter, ChevronDown, RotateCcw, RefreshCw } from 'lucide-react';
import { MultiSelectFilter } from '../ui/MultiSelectFilter';
import { ExportDropdown } from '../common/ExportDropdown';
import type { ExportColumn } from '../../utils/exportUtils';
import type { MslException } from '../../types/msl-alert';
import type { Category, Family, Warehouse, Location, Rack, Bin } from '../../services/masterDataService';

const UOM_OPTIONS = ['MM', 'NOS', 'PC', 'KG', 'KGS', 'MTRS', 'LTRS', 'BOX', 'PACK', 'SET', 'ROLL'];

export interface MslFilters {
  category?: string;
  zone?: string;
  severity?: string;
  search?: string;
  categories?: string[];
  families?: string[];
  warehouses?: string[];
  locations?: string[];
  racks?: string[];
  bins?: string[];
  uom?: string;
  mslStatus?: string;
  status?: string;
}

export interface MslFilterPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  onResetAll: () => void;
  onRefresh: () => void;
  isLoading: boolean;

  // Export properties
  exportData: MslException[];
  exportColumns: ExportColumn<MslException>[];

  // Master Data collections
  categories: Category[];
  selectedCategories: string[];
  onCategoriesChange: (vals: string[]) => void;

  families: Family[];
  selectedFamilies: string[];
  onFamiliesChange: (vals: string[]) => void;

  warehouses: Warehouse[];
  selectedWarehouses: string[];
  onWarehousesChange: (vals: string[]) => void;

  locations: Location[];
  selectedLocations: string[];
  onLocationsChange: (vals: string[]) => void;

  racks: Rack[];
  selectedRacks: string[];
  onRacksChange: (vals: string[]) => void;

  bins: Bin[];
  selectedBins: string[];
  onBinsChange: (vals: string[]) => void;

  // Single select filters
  uomFilter: string;
  onUomChange: (val: string) => void;

  mslFilter: string;
  onMslChange: (val: string) => void;

  statusFilter: string;
  onStatusChange: (val: string) => void;
}

export function MslFilterPanel({
  searchQuery,
  onSearchChange,
  showFilters,
  onToggleFilters,
  activeFilterCount,
  onResetAll,
  onRefresh,
  isLoading,
  exportData,
  exportColumns,
  categories,
  selectedCategories,
  onCategoriesChange,
  families,
  selectedFamilies,
  onFamiliesChange,
  warehouses,
  selectedWarehouses,
  onWarehousesChange,
  locations,
  selectedLocations,
  onLocationsChange,
  racks,
  selectedRacks,
  onRacksChange,
  bins,
  selectedBins,
  onBinsChange,
  uomFilter,
  onUomChange,
  mslFilter,
  onMslChange,
  statusFilter,
  onStatusChange,
}: MslFilterPanelProps) {
  // Build lookup maps for cascading filters
  const locMap = React.useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);
  const rackMap = React.useMemo(() => new Map(racks.map((r) => [r.id, r])), [racks]);

  // Cascading options
  const filteredFamilyOptions = React.useMemo(() => {
    return families.filter(
      (f) => selectedCategories.length === 0 || selectedCategories.includes(f.categoryId)
    );
  }, [families, selectedCategories]);

  const filteredLocationOptions = React.useMemo(() => {
    return locations.filter(
      (l) => selectedWarehouses.length === 0 || selectedWarehouses.includes(l.warehouseId)
    );
  }, [locations, selectedWarehouses]);

  const filteredRackOptions = React.useMemo(() => {
    return racks.filter((r) => {
      if (selectedLocations.length > 0 && !selectedLocations.includes(r.locationId)) return false;
      if (selectedWarehouses.length > 0) {
        const loc = locMap.get(r.locationId);
        if (!loc || !selectedWarehouses.includes(loc.warehouseId)) return false;
      }
      return true;
    });
  }, [racks, selectedLocations, selectedWarehouses, locMap]);

  const filteredBinOptions = React.useMemo(() => {
    return bins.filter((b) => {
      const rack = rackMap.get(b.rackId);
      if (selectedRacks.length > 0 && (!rack || !selectedRacks.includes(rack.id))) return false;
      if (selectedLocations.length > 0 && (!rack || !selectedLocations.includes(rack.locationId))) return false;
      if (selectedWarehouses.length > 0) {
        const loc = rack ? locMap.get(rack.locationId) : null;
        if (!loc || !selectedWarehouses.includes(loc.warehouseId)) return false;
      }
      return true;
    });
  }, [bins, selectedRacks, selectedLocations, selectedWarehouses, rackMap, locMap]);

  return (
    <div className="flex flex-col gap-3 bg-white dark:bg-[#121526] p-3.5 sm:p-4 rounded-2xl shadow-xs border border-slate-200 dark:border-[#1e233d] mb-4">
      {/* Row 1: Search & Primary Action Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Search products, codes, or bins..."
            className="pl-10 pr-3 h-11 w-full rounded-xl border border-slate-300 dark:border-[#1e233d] bg-slate-50 dark:bg-[#0e111f] text-base sm:text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-[#121526] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-between sm:justify-end">
          {/* Secondary Filters Collapsible Toggle */}
          <button
            type="button"
            onClick={onToggleFilters}
            className={`min-h-[44px] h-11 px-3.5 flex items-center gap-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
              activeFilterCount > 0 || showFilters
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                : 'border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#161a2e]'
            }`}
            title="Toggle Advanced Filters"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          <ExportDropdown
            data={exportData}
            columns={exportColumns}
            fileName="MSL_Stock_Breaches"
            reportTitle="Minimum Stock Level (MSL) Alerts & Exceptions"
            reportSubtitle={`Active stock breach records (${exportData.length} items)`}
            metadata={{
              'Total Exceptions': exportData.length,
              Search: searchQuery || 'All',
              'UOM Filter': uomFilter || 'All',
              'MSL Severity': mslFilter || 'All',
              'Status Filter': statusFilter || 'All',
            }}
          />

          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="min-h-[44px] h-11 px-3.5 flex items-center justify-center border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] hover:bg-slate-50 dark:hover:bg-[#161a2e] rounded-xl text-slate-600 dark:text-slate-300 transition-colors shadow-xs cursor-pointer shrink-0"
            title="Refresh MSL data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Row 2: Collapsible Secondary Filter Panel */}
      {showFilters && (
        <div className="pt-3 border-t border-slate-100 dark:border-[#1e233d] space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#8896ab]">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Filter Attributes:</span>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onResetAll}
                className="text-xs text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset All ({activeFilterCount})
              </button>
            )}
          </div>

          {/* Multiselect attributes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <MultiSelectFilter
              label="Category"
              placeholder="All Categories"
              options={categories.map((c) => ({ id: c.id, label: c.name }))}
              selectedValues={selectedCategories}
              onChange={onCategoriesChange}
            />
            <MultiSelectFilter
              label="Family"
              placeholder="All Families"
              options={filteredFamilyOptions.map((f) => ({
                id: f.id,
                label: f.name,
                subtext: f.category?.name,
              }))}
              selectedValues={selectedFamilies}
              onChange={onFamiliesChange}
            />
            <MultiSelectFilter
              label="Warehouse"
              placeholder="All Warehouses"
              options={warehouses.map((w) => ({ id: w.id, label: w.name, subtext: w.code }))}
              selectedValues={selectedWarehouses}
              onChange={onWarehousesChange}
            />
            <MultiSelectFilter
              label="Location"
              placeholder="All Locations"
              options={filteredLocationOptions.map((l) => ({
                id: l.id,
                label: l.name,
                subtext: l.code,
              }))}
              selectedValues={selectedLocations}
              onChange={onLocationsChange}
            />
            <MultiSelectFilter
              label="Rack"
              placeholder="All Racks"
              options={filteredRackOptions.map((r) => ({
                id: r.id,
                label: r.name,
                subtext: r.code,
              }))}
              selectedValues={selectedRacks}
              onChange={onRacksChange}
            />
            <MultiSelectFilter
              label="Bin"
              placeholder="All Bins"
              options={filteredBinOptions.map((b) => ({
                id: b.id,
                label: b.code,
                subtext: b.name,
              }))}
              selectedValues={selectedBins}
              onChange={onBinsChange}
            />
          </div>

          {/* Standard selects */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <select
              value={uomFilter}
              onChange={(e) => onUomChange(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
            >
              <option value="">All UOMs</option>
              {UOM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              value={mslFilter}
              onChange={(e) => onMslChange(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
            >
              <option value="">All MSL Monitoring</option>
              <option value="OUT_OF_STOCK">Zero Stock (Critical Out of Stock)</option>
              <option value="CRITICAL">Near Zero / Critical (&le;50% MSL)</option>
              <option value="LOW_STOCK">Near MSL (Low Stock)</option>
              <option value="NORMAL">Above MSL (Good)</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="min-h-[40px] px-3 rounded-xl border border-slate-300 dark:border-[#1e233d] bg-white dark:bg-[#0e111f] text-xs text-slate-700 dark:text-slate-200 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer font-medium"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
