import React, { useState, useEffect, useMemo } from 'react';
import {
  PageHeader,
  LoadingState,
  EmptyState,
  ErrorState,
  Button,
  SlideOver,
  FormField,
  TextInput,
  SearchSelect,
  Checkbox,
  StatusBadge,
} from '../components/ui';
import { masterDataService } from '../services/masterDataService';
import type { Warehouse, Location, Rack, Bin } from '../services/masterDataService';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Box,
  Building2,
  MapPin,
  Layers,
  Sparkles,
  RefreshCw,
  FolderPlus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export function WarehousesAndBinsWorkspace() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  // Modals & SlideOver State
  const [isAddBinOpen, setIsAddBinOpen] = useState(false);
  const [addBinContext, setAddBinContext] = useState<{
    warehouseId?: string;
    locationId?: string;
    rackId?: string;
  }>({});
  const [isAddWarehouseOpen, setIsAddWarehouseOpen] = useState(false);

  const loadWarehouses = async () => {
    try {
      setIsLoading(true);
      const res = await masterDataService.getWarehouses({ pageSize: 100 });
      setWarehouses(res.data);
      setError(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to load warehouses');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  const handleOpenAddBin = (ctx?: { warehouseId?: string; locationId?: string; rackId?: string }) => {
    setAddBinContext(ctx || {});
    setIsAddBinOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Warehouses & Storage Units Master"
        subtitle="Manage the storage hierarchy: Warehouses, Locations, Racks, and Storage Units."
        breadcrumbs={<span>Masters / Warehouses & Storage Units</span>}
        actionSlot={
          <div className="flex items-center space-x-3">
            <Button
              variant="secondary"
              onClick={loadWarehouses}
              disabled={isLoading}
              title="Refresh warehouses"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsAddWarehouseOpen(true)}
            >
              <FolderPlus className="w-4 h-4 mr-1.5" /> Add Warehouse
            </Button>
            <Button onClick={() => handleOpenAddBin()}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Storage Unit
            </Button>
          </div>
        }
      />

      {/* Main Content Area */}
      <div>
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
            <LoadingState />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs">
            <ErrorState message={error} onRetry={loadWarehouses} />
          </div>
        ) : warehouses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
            <EmptyState
              title="No warehouses configured"
              description="Create your first warehouse facility to start organizing storage locations, racks, and storage units."
            />
            <div className="mt-6 flex justify-center">
              <Button onClick={() => setIsAddWarehouseOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Create First Warehouse
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Select any location card to view its racks and storage units displayed across rows
              </span>
              <span>{warehouses.length} Warehouse{warehouses.length !== 1 ? 's' : ''} Active</span>
            </div>

            {warehouses.map((w) => (
              <WarehouseMasterCard
                key={w.id}
                warehouse={w}
                onOpenAddBin={handleOpenAddBin}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Warehouse Modal */}
      {isAddWarehouseOpen && (
        <AddWarehouseModal
          isOpen={isAddWarehouseOpen}
          onClose={() => setIsAddWarehouseOpen(false)}
          onSuccess={() => {
            setIsAddWarehouseOpen(false);
            loadWarehouses();
          }}
        />
      )}

      {/* Add Bin SlideOver with Preselection */}
      <AddBinSlideOver
        isOpen={isAddBinOpen}
        onClose={() => {
          setIsAddBinOpen(false);
          setAddBinContext({});
        }}
        onSuccess={() => {
          setIsAddBinOpen(false);
          setAddBinContext({});
          loadWarehouses();
        }}
        initialWarehouseId={addBinContext.warehouseId}
        initialLocationId={addBinContext.locationId}
        initialRackId={addBinContext.rackId}
      />
    </div>
  );
}

// ==========================================
// 1. Warehouse Master Card (Facility Container)
// ==========================================
function WarehouseMasterCard({
  warehouse,
  onOpenAddBin,
}: {
  warehouse: Warehouse;
  onOpenAddBin: (ctx: { warehouseId?: string; locationId?: string; rackId?: string }) => void;
}) {
  const [isWarehouseExpanded, setIsWarehouseExpanded] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const res = await masterDataService.getLocations({
        parentId: warehouse.id,
        pageSize: 100,
      });
      setLocations(res.data);
      setError(undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to load locations');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isWarehouseExpanded && locations.length === 0) {
      loadLocations();
    }
  }, [isWarehouseExpanded]);

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === selectedLocationId) || null,
    [locations, selectedLocationId]
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Warehouse Header */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 border-b border-slate-100">
        <div
          className="flex items-center space-x-3.5 cursor-pointer select-none group"
          onClick={() => setIsWarehouseExpanded(!isWarehouseExpanded)}
        >
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-xs group-hover:bg-blue-600 group-hover:text-white transition-all duration-200">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                {warehouse.name}
              </h3>
              <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs">
                {warehouse.code}
              </span>
              <StatusBadge status={warehouse.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Primary Warehouse Facility • {locations.length} Storage Location{locations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAddLocationOpen(true)}
            className="cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Location
          </Button>
          <button
            type="button"
            onClick={() => setIsWarehouseExpanded(!isWarehouseExpanded)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={isWarehouseExpanded ? 'Collapse warehouse' : 'Expand warehouse'}
          >
            {isWarehouseExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Warehouse Locations Grid */}
      {isWarehouseExpanded && (
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Storage Locations Grid
            </span>
            <span className="text-xs text-slate-400">
              Click any location to reveal storage racks across rows below
            </span>
          </div>

          {isLoading ? (
            <div className="py-8">
              <LoadingState />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadLocations} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {locations.map((loc) => {
                const isSelected = loc.id === selectedLocationId;
                return (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedLocationId(isSelected ? null : loc.id)}
                    className={`group relative rounded-xl border p-4.5 transition-all duration-200 ease-out cursor-pointer select-none ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/30 ring-2 ring-blue-500 shadow-md scale-[1.02]'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-500 hover:ring-2 hover:ring-blue-100 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-indigo-50 border border-indigo-100 text-indigo-600 group-hover:bg-blue-600 group-hover:text-white'
                          }`}
                        >
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-2xs">
                          {loc.code}
                        </span>
                      </div>
                      <StatusBadge status={loc.isActive ? 'ACTIVE' : 'INACTIVE'} />
                    </div>

                    <h4 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
                      {loc.name}
                    </h4>

                    <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-500">
                        Storage Location
                      </span>
                      <div className="flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                        <span>{isSelected ? 'Selected (Active)' : 'View Racks & Storage Units'}</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add Location Card (Dashed) */}
              <div
                onClick={() => setIsAddLocationOpen(true)}
                className="rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 p-5 transition-all duration-200 ease-out hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md flex flex-col items-center justify-center cursor-pointer text-center group min-h-[135px] select-none"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center text-slate-500 transition-colors mb-2">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="font-semibold text-sm text-slate-700 group-hover:text-blue-600 transition-colors">
                  Add Location
                </span>
                <span className="text-xs text-slate-400 mt-0.5">
                  Create new area in {warehouse.code}
                </span>
              </div>
            </div>
          )}

          {/* Dedicated Full-Width Row Grid for Racks & Bins (Requirement 3) */}
          {selectedLocation && (
            <RacksAndBinsRowView
              key={selectedLocation.id}
              warehouse={warehouse}
              location={selectedLocation}
              onClose={() => setSelectedLocationId(null)}
              onOpenAddBin={onOpenAddBin}
            />
          )}
        </div>
      )}

      {/* Add Location Modal */}
      {isAddLocationOpen && (
        <AddLocationModal
          warehouseId={warehouse.id}
          warehouseName={warehouse.name}
          isOpen={isAddLocationOpen}
          onClose={() => setIsAddLocationOpen(false)}
          onSuccess={() => {
            setIsAddLocationOpen(false);
            loadLocations();
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// 2. Full-Width Racks & Bins Row View (Requirement 3: Racks Across Rows)
// ==========================================
function RacksAndBinsRowView({
  warehouse,
  location,
  onClose,
  onOpenAddBin,
}: {
  warehouse: Warehouse;
  location: Location;
  onClose: () => void;
  onOpenAddBin: (ctx: { warehouseId?: string; locationId?: string; rackId?: string }) => void;
}) {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rackSearch, setRackSearch] = useState('');
  const [isAddRackOpen, setIsAddRackOpen] = useState(false);

  const loadRacks = async () => {
    setIsLoading(true);
    try {
      const res = await masterDataService.getRacks({
        parentId: location.id,
        pageSize: 100,
      });
      setRacks(res.data);
    } catch (err: any) {
      console.error('Failed to load racks', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRacks();
  }, [location.id]);

  const filteredRacks = useMemo(() => {
    if (!rackSearch.trim()) return racks;
    const q = rackSearch.toLowerCase().trim();
    return racks.filter(
      (r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [racks, rackSearch]);

  return (
    <div className="mt-4 bg-slate-50/80 rounded-2xl border border-blue-200/90 p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
      {/* Header Bar spanning full width */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="font-bold text-slate-900 text-lg">
                Storage Hierarchy in {location.name}
              </h4>
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                {location.code}
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {racks.length} Rack{racks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Arranged in responsive rows • Hover over any storage unit to scale and inspect details
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Quick Rack Search Bar */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search racks by code/name..."
              value={rackSearch}
              onChange={(e) => setRackSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600 shadow-xs"
            />
            {rackSearch && (
              <button
                type="button"
                onClick={() => setRackSearch('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <Button size="sm" onClick={() => setIsAddRackOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Rack
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
            title="Close racks bay"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Racks Grid Across Rows (Boxy Form) */}
      {isLoading ? (
        <div className="py-8">
          <LoadingState />
        </div>
      ) : racks.length === 0 ? (
        <div className="py-8 text-center bg-white rounded-xl border border-slate-200 p-6">
          <Layers className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h5 className="font-bold text-slate-800 text-sm">No storage racks in this location yet</h5>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Create your first storage rack or shelving bay to begin placing storage units.
          </p>
          <Button size="sm" onClick={() => setIsAddRackOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Create First Rack
          </Button>
        </div>
      ) : filteredRacks.length === 0 ? (
        <div className="py-8 text-center bg-white rounded-xl border border-slate-200 p-6 text-xs text-slate-500">
          No racks matched "{rackSearch}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRacks.map((rack) => (
            <RackBoxCard
              key={rack.id}
              rack={rack}
              warehouseId={warehouse.id}
              locationId={location.id}
              onOpenAddBin={onOpenAddBin}
            />
          ))}
        </div>
      )}

      {/* Add Rack Modal */}
      {isAddRackOpen && (
        <AddRackModal
          locationId={location.id}
          locationName={location.name}
          isOpen={isAddRackOpen}
          onClose={() => setIsAddRackOpen(false)}
          onSuccess={() => {
            setIsAddRackOpen(false);
            loadRacks();
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// 3. Rack Box Card with Wide, Legible Bins (Requirement 1 & 3)
// ==========================================
function RackBoxCard({
  rack,
  warehouseId,
  locationId,
  onOpenAddBin,
}: {
  rack: Rack;
  warehouseId: string;
  locationId: string;
  onOpenAddBin: (ctx: { warehouseId?: string; locationId?: string; rackId?: string }) => void;
}) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBins = async () => {
    setIsLoading(true);
    try {
      const res = await masterDataService.getBins({
        parentId: rack.id,
        pageSize: 100,
      });
      setBins(res.data);
    } catch (err: any) {
      console.error('Failed to load bins for rack', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBins();
  }, [rack.id]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4.5 shadow-xs hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between space-y-3.5">
      {/* Rack Title Bar */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center space-x-2 min-w-0">
            <Layers className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="font-bold text-slate-900 text-sm truncate" title={rack.name}>
              {rack.name}
            </span>
          </div>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 shrink-0 ml-1">
            {rack.code}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
          <span>{bins.length} Unit{bins.length !== 1 ? 's' : ''} Allocated</span>
          <button
            type="button"
            onClick={() => onOpenAddBin({ warehouseId, locationId, rackId: rack.id })}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New Unit
          </button>
        </div>
      </div>

      {/* Bins Grid with Roomy, Legible Layout (Requirement 1: Wide & Clear Values) */}
      <div className="space-y-2 pt-1 flex-1">
        {isLoading ? (
          <div className="py-2">
            <LoadingState />
          </div>
        ) : bins.length === 0 ? (
          <div
            onClick={() => onOpenAddBin({ warehouseId, locationId, rackId: rack.id })}
            className="p-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 hover:bg-blue-50/30 hover:border-blue-500 text-center cursor-pointer text-xs text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4 mx-auto mb-1 text-slate-400" />
            <span>Empty rack — Add first unit</span>
          </div>
        ) : (
          <div className="space-y-2">
            {bins.map((bin) => (
              <div
                key={bin.id}
                className="group/bin flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white transition-all duration-200 ease-out hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-sm hover:border-blue-500 hover:ring-2 hover:ring-blue-100 cursor-pointer select-none"
                title={`Storage Unit: ${bin.code}`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover/bin:bg-blue-600 group-hover/bin:text-white transition-all duration-200">
                    <Box className="w-3.5 h-3.5" />
                  </div>
                  {/* Single-line bold monospace bin code, never wraps awkwardly! */}
                  <span className="font-mono text-xs font-bold text-slate-900 group-hover/bin:text-blue-600 transition-colors whitespace-nowrap">
                    {bin.code}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      bin.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <span className="text-[11px] font-medium text-slate-500">
                    {bin.isActive ? 'Active' : 'Off'}
                  </span>
                </div>
              </div>
            ))}

            {/* Quick Add Bin Button */}
            <div
              onClick={() => onOpenAddBin({ warehouseId, locationId, rackId: rack.id })}
              className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-slate-300 bg-white hover:bg-blue-50/40 hover:border-blue-500 text-slate-400 hover:text-blue-600 transition-all duration-200 hover:scale-[1.02] cursor-pointer text-xs font-medium select-none"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Unit to {rack.code}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. Creation Modals (Warehouse, Location, Rack)
// ==========================================
function AddWarehouseModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return toast.error('Code and Name are required');
    setLoading(true);
    try {
      await masterDataService.createWarehouse({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        isActive: true,
      });
      toast.success('Warehouse created successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create warehouse');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4.5 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Add New Warehouse</h3>
            <p className="text-xs text-slate-500">Register a new facility or storage depot</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Warehouse Code" required hint="e.g. WH-SOUTH or MAIN-DEPOT">
            <TextInput
              placeholder="e.g. WH-MAIN"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </FormField>

          <FormField label="Warehouse Name" required hint="Descriptive facility name">
            <TextInput
              placeholder="e.g. Main Raw Material Warehouse"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Warehouse'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddLocationModal({
  warehouseId,
  warehouseName,
  isOpen,
  onClose,
  onSuccess,
}: {
  warehouseId: string;
  warehouseName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return toast.error('Code and Name are required');
    setLoading(true);
    try {
      await masterDataService.createLocation({
        warehouseId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        isActive: true,
      });
      toast.success('Location created successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create location');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4.5 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Add Storage Location</h3>
            <p className="text-xs text-slate-500">Inside {warehouseName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Location Code" required hint="e.g. LOC-QC, LOC-COLD, BAY-A">
            <TextInput
              placeholder="e.g. LOC-01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </FormField>

          <FormField label="Location Name" required hint="Descriptive area name">
            <TextInput
              placeholder="e.g. Inward QC Area"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Location'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddRackModal({
  locationId,
  locationName,
  isOpen,
  onClose,
  onSuccess,
}: {
  locationId: string;
  locationName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return toast.error('Code and Name are required');
    setLoading(true);
    try {
      await masterDataService.createRack({
        locationId,
        code: code.trim().toUpperCase(),
        name: name.trim(),
        isActive: true,
      });
      toast.success('Rack created successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create rack');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4.5 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Add Storage Rack</h3>
            <p className="text-xs text-slate-500">Inside {locationName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Rack Code" required hint="e.g. RCK-01 or AISLE-B">
            <TextInput
              placeholder="e.g. RCK-01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </FormField>

          <FormField label="Rack Name" required hint="Descriptive rack or aisle label">
            <TextInput
              placeholder="e.g. General Storage Rack 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FormField>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Rack'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. Modern Add Bin SlideOver (Requirement 4: Matches UI Theme with Preselection)
// ==========================================
function AddBinSlideOver({
  isOpen,
  onClose,
  onSuccess,
  initialWarehouseId,
  initialLocationId,
  initialRackId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialWarehouseId?: string;
  initialLocationId?: string;
  initialRackId?: string;
}) {
  const [warehouses, setWarehouses] = useState<{ id: string; primary: string; secondary?: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; primary: string; secondary?: string }[]>([]);
  const [racks, setRacks] = useState<{ id: string; primary: string; secondary?: string }[]>([]);

  const [selectedWarehouse, setSelectedWarehouse] = useState<string | undefined>(initialWarehouseId);
  const [selectedLocation, setSelectedLocation] = useState<string | undefined>(initialLocationId);
  const [selectedRack, setSelectedRack] = useState<string | undefined>(initialRackId);
  const [isCreatingRack, setIsCreatingRack] = useState(false);
  const [newRackCode, setNewRackCode] = useState('');
  const [newRackName, setNewRackName] = useState('');

  const [binCode, setBinCode] = useState('');
  const [binName, setBinName] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);

  // Initialize and load warehouses
  useEffect(() => {
    if (isOpen) {
      masterDataService.getWarehouses({ pageSize: 100 }).then((res) => {
        const whList = res.data.map((w) => ({ id: w.id, primary: w.name, secondary: w.code }));
        setWarehouses(whList);

        // Preselect warehouse if passed, or auto-select if only 1 warehouse exists
        if (initialWarehouseId) {
          setSelectedWarehouse(initialWarehouseId);
        } else if (whList.length === 1) {
          setSelectedWarehouse(whList[0].id);
        } else {
          setSelectedWarehouse(undefined);
        }
      });

      setSelectedLocation(initialLocationId);
      setSelectedRack(initialRackId);
      setIsCreatingRack(false);
      setNewRackCode('');
      setNewRackName('');
      setBinCode('');
      setBinName('');
      setIsActive(true);
    }
  }, [isOpen, initialWarehouseId, initialLocationId, initialRackId]);

  // Load locations when warehouse is selected
  useEffect(() => {
    if (selectedWarehouse) {
      masterDataService.getLocations({ parentId: selectedWarehouse, pageSize: 100 }).then((res) => {
        const locList = res.data.map((l) => ({ id: l.id, primary: l.name, secondary: l.code }));
        setLocations(locList);

        if (initialLocationId && locList.some((l) => l.id === initialLocationId)) {
          setSelectedLocation(initialLocationId);
        } else if (locList.length === 1) {
          setSelectedLocation(locList[0].id);
        }
      });
    } else {
      setLocations([]);
      setSelectedLocation(undefined);
    }
  }, [selectedWarehouse, initialLocationId]);

  // Load racks when location is selected
  useEffect(() => {
    if (selectedLocation) {
      masterDataService.getRacks({ parentId: selectedLocation, pageSize: 100 }).then((res) => {
        const rackList = res.data.map((r) => ({ id: r.id, primary: r.name, secondary: r.code }));
        setRacks(rackList);

        if (initialRackId && rackList.some((r) => r.id === initialRackId)) {
          setSelectedRack(initialRackId);
        }
      });
    } else {
      setRacks([]);
      setSelectedRack(undefined);
    }
  }, [selectedLocation, initialRackId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return toast.error('Please select a storage location');
    if (!selectedRack && !isCreatingRack) return toast.error('Please select or create a rack');
    if (!binCode.trim()) return toast.error('Bin code is required');

    setLoading(true);
    try {
      let finalRackId = selectedRack;

      if (isCreatingRack) {
        if (!newRackCode.trim()) throw new Error('New rack code is required');
        const rack = await masterDataService.createRack({
          locationId: selectedLocation,
          code: newRackCode.trim().toUpperCase(),
          name: newRackName.trim() || newRackCode.trim().toUpperCase(),
          isActive: true,
        });
        finalRackId = rack.id;
      }

      if (!finalRackId) throw new Error('Target Rack ID is missing');

      await masterDataService.createBin({
        rackId: finalRackId,
        code: binCode.trim().toUpperCase(),
        name: binName.trim() || binCode.trim().toUpperCase(),
        isActive,
      });

      toast.success(`Bin ${binCode.trim().toUpperCase()} added successfully`);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save bin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Add Storage Bin</h3>
            <p className="text-xs text-slate-500 font-normal">
              Register a bin within your warehouse storage hierarchy
            </p>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Storage Location Placement */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            1. Storage Location Placement
          </h4>

          <FormField label="Warehouse Facility" id="warehouse" required hint="Target storage facility">
            <SearchSelect
              options={warehouses}
              value={selectedWarehouse}
              onChange={(id) => {
                setSelectedWarehouse(id);
                setSelectedLocation(undefined);
                setSelectedRack(undefined);
              }}
              placeholder="Select Warehouse..."
            />
          </FormField>

          {selectedWarehouse ? (
            <FormField label="Storage Location" id="location" required hint="Area inside warehouse">
              <SearchSelect
                options={locations}
                value={selectedLocation}
                onChange={(id) => {
                  setSelectedLocation(id);
                  setSelectedRack(undefined);
                }}
                placeholder="Select Location in Warehouse..."
              />
            </FormField>
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
              Select a warehouse facility above to view storage locations.
            </div>
          )}
        </div>

        {/* Step 2: Rack Assignment */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              2. Rack Assignment
            </h4>
            {selectedLocation && (
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                onClick={() => setIsCreatingRack(!isCreatingRack)}
              >
                {isCreatingRack ? '← Choose Existing Rack' : '+ Create New Rack'}
              </button>
            )}
          </div>

          {selectedLocation ? (
            isCreatingRack ? (
              <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <FormField label="New Rack Code" id="rack-code" required>
                  <TextInput
                    value={newRackCode}
                    onChange={(e) => setNewRackCode(e.target.value.toUpperCase())}
                    placeholder="e.g. RCK-02"
                    required
                  />
                </FormField>
                <FormField label="New Rack Name" id="rack-name">
                  <TextInput
                    value={newRackName}
                    onChange={(e) => setNewRackName(e.target.value)}
                    placeholder="e.g. Heavy Duty Rack"
                  />
                </FormField>
              </div>
            ) : (
              <FormField label="Target Rack" id="rack" required hint="Storage bay inside selected location">
                <SearchSelect
                  options={racks}
                  value={selectedRack}
                  onChange={setSelectedRack}
                  placeholder="Select Rack in Location..."
                />
              </FormField>
            )
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
              Select a storage location to assign a rack.
            </div>
          )}
        </div>

        {/* Step 3: Bin Details */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            3. Bin Specification
          </h4>

          <FormField label="Bin Code" id="bin-code" required hint="e.g. A-01-01, B-02-04, BIN-100">
            <TextInput
              value={binCode}
              onChange={(e) => setBinCode(e.target.value.toUpperCase())}
              placeholder="e.g. A-01-01"
              required
            />
          </FormField>

          <FormField label="Bin Label / Shelf (Optional)" id="bin-name" hint="Descriptive shelf or position note">
            <TextInput
              value={binName}
              onChange={(e) => setBinName(e.target.value)}
              placeholder="e.g. Top Shelf Row 1"
            />
          </FormField>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200">
            <Checkbox
              id="bin-active"
              label="Active Bin Status"
              description="Active bins are available for stock allocation, GRN inwarding, and dispatch."
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-2.5 pt-6 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || (!selectedRack && !isCreatingRack) || !binCode.trim()}
          >
            {loading ? 'Saving Bin...' : 'Save Bin'}
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
