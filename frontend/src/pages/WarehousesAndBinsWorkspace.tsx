import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export function WarehousesAndBinsWorkspace() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [isAddBinOpen, setIsAddBinOpen] = useState(false);
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

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Warehouses & Bins Master"
        subtitle="Manage the storage hierarchy: Warehouses, Locations, Racks, and Bins."
        breadcrumbs={<span>Masters / Warehouses & Bins</span>}
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
            <Button onClick={() => setIsAddBinOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Bin
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
              description="Create your first warehouse facility to start organizing storage locations, racks, and bins."
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
                Interactive Storage Hierarchy — hover over cards to highlight and scale
              </span>
              <span>{warehouses.length} Warehouse{warehouses.length !== 1 ? 's' : ''} Active</span>
            </div>

            {warehouses.map((w) => (
              <WarehouseCard key={w.id} warehouse={w} />
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

      {/* Add Bin SlideOver */}
      <AddBinSlideOver
        isOpen={isAddBinOpen}
        onClose={() => setIsAddBinOpen(false)}
        onSuccess={() => {
          setIsAddBinOpen(false);
          loadWarehouses();
        }}
      />
    </div>
  );
}

// ==========================================
// 1. Warehouse Card (Top-Level Box)
// ==========================================
function WarehouseCard({ warehouse }: { warehouse: Warehouse }) {
  const [expanded, setExpanded] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
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
    if (expanded && locations.length === 0) {
      loadLocations();
    }
  }, [expanded]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-300 overflow-hidden">
      {/* Warehouse Header Bar */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/70 border-b border-slate-100">
        <div
          className="flex items-center space-x-3.5 cursor-pointer select-none group"
          onClick={() => setExpanded(!expanded)}
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
              Primary Warehouse Facility • {locations.length} Location{locations.length !== 1 ? 's' : ''}
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
            onClick={() => setExpanded(!expanded)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title={expanded ? 'Collapse warehouse' : 'Expand warehouse'}
          >
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Warehouse Locations Grid */}
      {expanded && (
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Storage Locations
            </span>
            <span className="text-xs text-slate-400">
              Click a location box to view racks & bins
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
              {locations.map((loc) => (
                <LocationBoxCard key={loc.id} location={loc} />
              ))}

              {/* Add Location Card (Box Type) */}
              <div
                onClick={() => setIsAddLocationOpen(true)}
                className="rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/30 p-5 transition-all duration-200 ease-out hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-md flex flex-col items-center justify-center cursor-pointer text-center group min-h-[140px] select-none"
              >
                <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-100 group-hover:text-blue-600 flex items-center justify-center text-slate-500 transition-colors mb-2">
                  <Plus className="w-5 h-5" />
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
// 2. Location Box Card (Box Type with Hover Scale)
// ==========================================
function LocationBoxCard({ location }: { location: Location }) {
  const [expanded, setExpanded] = useState(false);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (expanded && racks.length === 0) {
      loadRacks();
    }
  }, [expanded]);

  return (
    <div className="flex flex-col">
      {/* The Box Type Card with Hover-Scale Animation */}
      <div
        onClick={() => setExpanded(!expanded)}
        className={`group relative rounded-xl border p-4.5 transition-all duration-200 ease-out cursor-pointer select-none ${
          expanded
            ? 'border-blue-500 bg-white ring-2 ring-blue-100 shadow-md scale-[1.01]'
            : 'border-slate-200 bg-slate-50/70 hover:bg-white hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-500 hover:ring-2 hover:ring-blue-100 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
              <MapPin className="w-4 h-4" />
            </div>
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 shadow-2xs">
              {location.code}
            </span>
          </div>
          <StatusBadge status={location.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </div>

        <h4 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
          {location.name}
        </h4>

        <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-600">
            {racks.length > 0 ? `${racks.length} Rack${racks.length !== 1 ? 's' : ''}` : 'Click to inspect racks'}
          </span>
          <div className="flex items-center gap-1 text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
            <span>{expanded ? 'Hide Racks' : 'View Racks'}</span>
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </div>
        </div>
      </div>

      {/* Expanded Racks & Bins Section */}
      {expanded && (
        <div className="mt-3 p-4 bg-white rounded-xl border border-blue-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Racks in {location.code}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsAddRackOpen(true);
              }}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Rack
            </button>
          </div>

          {isLoading ? (
            <div className="py-4">
              <LoadingState />
            </div>
          ) : racks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-slate-500 mb-2">No racks registered in this location yet.</p>
              <Button size="sm" variant="secondary" onClick={() => setIsAddRackOpen(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add First Rack
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {racks.map((r) => (
                <RackStorageCard key={r.id} rack={r} />
              ))}
            </div>
          )}
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
// 3. Rack Card & Bins Grid (Box Type with Cursor Hover Animation)
// ==========================================
function RackStorageCard({ rack }: { rack: Rack }) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddBinOpen, setIsAddBinOpen] = useState(false);

  const loadBins = async () => {
    setIsLoading(true);
    try {
      const res = await masterDataService.getBins({
        parentId: rack.id,
        pageSize: 100,
      });
      setBins(res.data);
    } catch (err: any) {
      console.error('Failed to load bins', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBins();
  }, [rack.id]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-xs space-y-3">
      {/* Rack Title Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-slate-500" />
          <span className="font-semibold text-slate-800 text-sm">{rack.name}</span>
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
            {rack.code}
          </span>
          <span className="text-xs text-slate-400">({bins.length} Bins)</span>
        </div>
        <button
          type="button"
          onClick={() => setIsAddBinOpen(true)}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 hover:underline cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> New Bin
        </button>
      </div>

      {/* Bins Grid (Interactive Box Type with Cursor Hover Growth) */}
      {isLoading ? (
        <div className="py-2">
          <LoadingState />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
          {bins.map((bin) => (
            <div
              key={bin.id}
              className="group/bin relative flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 bg-white shadow-2xs transition-all duration-200 ease-out hover:scale-110 hover:-translate-y-1 hover:shadow-md hover:border-blue-600 hover:ring-2 hover:ring-blue-100 cursor-pointer text-center select-none"
              title={`Bin: ${bin.code} (${bin.name || 'Active'})`}
            >
              <Box className="w-5 h-5 text-slate-400 group-hover/bin:text-blue-600 group-hover/bin:scale-110 transition-all duration-200 mb-1" />
              <span className="font-mono text-xs font-bold text-slate-800 group-hover/bin:text-blue-700 transition-colors">
                {bin.code}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    bin.isActive ? 'bg-emerald-500' : 'bg-red-400'
                  }`}
                />
                <span className="text-[10px] text-slate-400">
                  {bin.isActive ? 'Active' : 'Off'}
                </span>
              </div>
            </div>
          ))}

          {/* Quick Add Bin Box in Grid */}
          <div
            onClick={() => setIsAddBinOpen(true)}
            className="flex flex-col items-center justify-center p-2.5 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 hover:bg-blue-50/40 hover:border-blue-500 text-slate-400 hover:text-blue-600 transition-all duration-200 hover:scale-105 cursor-pointer text-center min-h-[72px] select-none"
          >
            <Plus className="w-4 h-4 mb-0.5" />
            <span className="text-xs font-medium">Add Bin</span>
          </div>
        </div>
      )}

      {/* Add Bin Modal for this Rack */}
      {isAddBinOpen && (
        <AddBinModal
          rackId={rack.id}
          rackName={rack.name}
          isOpen={isAddBinOpen}
          onClose={() => setIsAddBinOpen(false)}
          onSuccess={() => {
            setIsAddBinOpen(false);
            loadBins();
          }}
        />
      )}
    </div>
  );
}

// ==========================================
// 4. Modern Creation Modals & Forms
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

function AddBinModal({
  rackId,
  rackName,
  isOpen,
  onClose,
  onSuccess,
}: {
  rackId: string;
  rackName: string;
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
    if (!code.trim()) return toast.error('Bin Code is required');
    setLoading(true);
    try {
      await masterDataService.createBin({
        rackId,
        code: code.trim().toUpperCase(),
        name: name.trim() || code.trim().toUpperCase(),
        isActive: true,
      });
      toast.success('Bin created successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create bin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4.5 bg-slate-50/70 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Add Storage Bin</h3>
            <p className="text-xs text-slate-500">Inside {rackName}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <FormField label="Bin Code" required hint="e.g. A-01-01 or BIN-X10">
            <TextInput
              placeholder="e.g. A-01-01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </FormField>

          <FormField label="Bin Label / Name" hint="Optional description or shelf note">
            <TextInput
              placeholder="e.g. Top Shelf Compartment 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </FormField>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Bin'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 5. Full Cascade Add Bin SlideOver
// ==========================================
function AddBinSlideOver({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [warehouses, setWarehouses] = useState<{ id: string; primary: string; secondary?: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; primary: string; secondary?: string }[]>([]);
  const [racks, setRacks] = useState<{ id: string; primary: string; secondary?: string }[]>([]);

  const [selectedWarehouse, setSelectedWarehouse] = useState<string>();
  const [selectedLocation, setSelectedLocation] = useState<string>();
  const [selectedRack, setSelectedRack] = useState<string>();
  const [isCreatingRack, setIsCreatingRack] = useState(false);
  const [newRackCode, setNewRackCode] = useState('');
  const [newRackName, setNewRackName] = useState('');

  const [binCode, setBinCode] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      masterDataService.getWarehouses({ pageSize: 100 }).then((res) => {
        setWarehouses(res.data.map((w) => ({ id: w.id, primary: w.name, secondary: w.code })));
      });
      setSelectedWarehouse(undefined);
      setSelectedLocation(undefined);
      setSelectedRack(undefined);
      setIsCreatingRack(false);
      setNewRackCode('');
      setNewRackName('');
      setBinCode('');
      setIsActive(true);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedWarehouse) {
      masterDataService.getLocations({ parentId: selectedWarehouse, pageSize: 100 }).then((res) => {
        setLocations(res.data.map((l) => ({ id: l.id, primary: l.name, secondary: l.code })));
      });
      setSelectedLocation(undefined);
      setSelectedRack(undefined);
    } else {
      setLocations([]);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (selectedLocation) {
      masterDataService.getRacks({ parentId: selectedLocation, pageSize: 100 }).then((res) => {
        setRacks(res.data.map((r) => ({ id: r.id, primary: r.name, secondary: r.code })));
      });
      setSelectedRack(undefined);
    } else {
      setRacks([]);
    }
  }, [selectedLocation]);

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
        name: binCode.trim().toUpperCase(),
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
    <SlideOver isOpen={isOpen} onClose={onClose} title="Add New Bin">
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormField label="Warehouse Facility" id="warehouse" required hint="Select target warehouse">
          <SearchSelect
            options={warehouses}
            value={selectedWarehouse}
            onChange={setSelectedWarehouse}
            placeholder="Select Warehouse Facility..."
          />
        </FormField>

        {selectedWarehouse && (
          <FormField label="Storage Location" id="location" required hint="Select area within warehouse">
            <SearchSelect
              options={locations}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="Select Location..."
            />
          </FormField>
        )}

        {selectedLocation && (
          <div className="space-y-4 border border-slate-200 p-4 rounded-xl bg-slate-50/70">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rack Selection
              </label>
              <button
                type="button"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                onClick={() => setIsCreatingRack(!isCreatingRack)}
              >
                {isCreatingRack ? '← Select Existing Rack' : '+ Create New Rack'}
              </button>
            </div>

            {isCreatingRack ? (
              <div className="grid grid-cols-2 gap-4">
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
              <SearchSelect
                options={racks}
                value={selectedRack}
                onChange={setSelectedRack}
                placeholder="Select Rack in Location..."
              />
            )}
          </div>
        )}

        {(selectedRack || isCreatingRack) && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Bin Specification
            </h3>
            <FormField label="Bin Code" id="bin-code" required hint="e.g. A-01-01, B-02-04">
              <TextInput
                value={binCode}
                onChange={(e) => setBinCode(e.target.value.toUpperCase())}
                placeholder="e.g. A-01-01"
                required
              />
            </FormField>

            <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200">
              <Checkbox
                id="is-active"
                label="Bin Active Status"
                description="Active bins are available for stock allocation, GRN inwarding, and storage."
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
            </div>
          </div>
        )}

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
