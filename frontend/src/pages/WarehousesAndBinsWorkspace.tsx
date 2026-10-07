import React, { useState, useEffect } from 'react';
import {
  PageHeader, LoadingState, EmptyState, ErrorState, Button, SlideOver,
  FormField, TextInput, SearchSelect, Checkbox, StatusBadge
} from '../components/ui';
import { masterDataService } from '../services/masterDataService';
import type { Warehouse, Location, Rack, Bin } from '../services/masterDataService';
import { ChevronRight, ChevronDown, Plus, Box } from 'lucide-react';

export function WarehousesAndBinsWorkspace() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const [isAddBinOpen, setIsAddBinOpen] = useState(false);

  const loadWarehouses = async () => {
    try {
      setIsLoading(true);
      const res = await masterDataService.getWarehouses({ pageSize: 1000 });
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
          <Button onClick={() => setIsAddBinOpen(true)}>Add Bin</Button>
        }
      />

      <div className="bg-white rounded shadow p-4 border">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={loadWarehouses} />
        ) : warehouses.length === 0 ? (
          <div className="text-center py-8">
            <EmptyState title="No warehouses found" description="Add one below." />
            <AddWarehouseInline onAdd={loadWarehouses} />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-4">Note: Expandable list showing the storage hierarchy.</p>
            {warehouses.map(w => (
              <WarehouseNode key={w.id} warehouse={w} />
            ))}
            <div className="mt-4 pt-4 border-t">
              <AddWarehouseInline onAdd={loadWarehouses} />
            </div>
          </div>
        )}
      </div>

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

function WarehouseNode({ warehouse }: { warehouse: Warehouse }) {
  const [expanded, setExpanded] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();

  const loadLocations = async () => {
    try {
      setIsLoading(true);
      const res = await masterDataService.getLocations({ parentId: warehouse.id, pageSize: 1000 });
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
    <div className="border rounded-md mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span className="font-semibold text-gray-800">Warehouse: {warehouse.name} ({warehouse.code})</span>
          {!warehouse.isActive && <StatusBadge status="REJECTED" />}
        </div>
      </div>
      {expanded && (
        <div className="p-4 bg-white border-t border-gray-100 pl-8">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={loadLocations} />
          ) : (
            <div className="space-y-2">
              {locations.map(loc => (
                <LocationNode key={loc.id} location={loc} />
              ))}
              <div className="mt-2 pt-2 border-t border-dashed">
                <AddLocationInline warehouseId={warehouse.id} onAdd={loadLocations} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LocationNode({ location }: { location: Location }) {
  const [expanded, setExpanded] = useState(false);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadRacks = async () => {
    setIsLoading(true);
    const res = await masterDataService.getRacks({ parentId: location.id, pageSize: 1000 });
    setRacks(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (expanded && racks.length === 0) {
      loadRacks();
    }
  }, [expanded]);

  return (
    <div className="border border-blue-100 rounded mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between p-2 bg-blue-50 hover:bg-blue-100 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2 text-sm">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium text-blue-900">Location: {location.name} ({location.code})</span>
          {!location.isActive && <StatusBadge status="REJECTED" />}
        </div>
      </div>
      {expanded && (
        <div className="p-3 bg-white border-t border-blue-100 pl-6 text-sm">
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="space-y-2">
              {racks.map(rack => (
                <RackNode key={rack.id} rack={rack} />
              ))}
              <div className="mt-2 pt-2 border-t border-dashed">
                <AddRackInline locationId={location.id} onAdd={loadRacks} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RackNode({ rack }: { rack: Rack }) {
  const [expanded, setExpanded] = useState(false);
  const [bins, setBins] = useState<Bin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBins = async () => {
    setIsLoading(true);
    const res = await masterDataService.getBins({ parentId: rack.id, pageSize: 1000 });
    setBins(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (expanded && bins.length === 0) {
      loadBins();
    }
  }, [expanded]);

  return (
    <div className="border border-green-100 rounded mb-2 overflow-hidden">
      <div
        className="flex items-center justify-between p-2 bg-green-50 hover:bg-green-100 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center space-x-2 text-sm">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <span className="font-medium text-green-900">Rack: {rack.name} ({rack.code})</span>
          {!rack.isActive && <StatusBadge status="REJECTED" />}
        </div>
      </div>
      {expanded && (
        <div className="p-3 bg-white border-t border-green-100 pl-6 text-sm">
          {isLoading ? (
            <LoadingState />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {bins.map(bin => (
                <div key={bin.id} className="flex items-center space-x-2 p-2 border rounded bg-gray-50">
                  <Box size={14} className="text-gray-400" />
                  <span className="font-mono text-xs font-bold">{bin.code}</span>
                  {!bin.isActive && <span className="text-[10px] bg-red-100 text-red-800 px-1 rounded">Inactive</span>}
                </div>
              ))}
              <div className="col-span-full mt-2 border-t border-dashed pt-2">
                <AddBinInline rackId={rack.id} onAdd={loadBins} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AddWarehouseInline({ onAdd }: { onAdd: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await masterDataService.createWarehouse({ code, name, isActive: true });
      setCode('');
      setName('');
      setIsOpen(false);
      onAdd();
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return <Button variant="secondary" onClick={() => setIsOpen(true)}><Plus size={16} className="mr-2" /> Add Warehouse</Button>;
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <TextInput placeholder="Code" value={code} onChange={e => setCode(e.target.value)} required />
      <TextInput placeholder="Name" value={name} onChange={e => setName(e.target.value)} required />
      <Button type="submit" disabled={loading}>Save</Button>
      <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
    </form>
  );
}

function AddLocationInline({ warehouseId, onAdd }: { warehouseId: string, onAdd: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await masterDataService.createLocation({ warehouseId, code, name, isActive: true });
      setCode('');
      setName('');
      setIsOpen(false);
      onAdd();
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return <button type="button" className="text-blue-600 text-sm flex items-center hover:underline" onClick={() => setIsOpen(true)}><Plus size={14} className="mr-1" /> Add Location</button>;
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <TextInput placeholder="Loc Code" value={code} onChange={e => setCode(e.target.value)} required />
      <TextInput placeholder="Loc Name" value={name} onChange={e => setName(e.target.value)} required />
      <Button type="submit" disabled={loading}>Save</Button>
      <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
    </form>
  );
}

function AddRackInline({ locationId, onAdd }: { locationId: string, onAdd: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await masterDataService.createRack({ locationId, code, name, isActive: true });
      setCode('');
      setName('');
      setIsOpen(false);
      onAdd();
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return <button type="button" className="text-green-600 text-sm flex items-center hover:underline" onClick={() => setIsOpen(true)}><Plus size={14} className="mr-1" /> Add Rack</button>;
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <TextInput placeholder="Rack Code" value={code} onChange={e => setCode(e.target.value)} required />
      <TextInput placeholder="Rack Name" value={name} onChange={e => setName(e.target.value)} required />
      <Button type="submit" disabled={loading}>Save</Button>
      <Button type="button" variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
    </form>
  );
}

function AddBinInline({ rackId, onAdd }: { rackId: string, onAdd: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await masterDataService.createBin({ rackId, code, name, isActive: true });
      setCode('');
      setName('');
      setIsOpen(false);
      onAdd();
    } catch (err: any) {
      alert(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return <button type="button" className="text-gray-600 text-xs flex items-center hover:underline" onClick={() => setIsOpen(true)}><Plus size={12} className="mr-1" /> Add Bin</button>;
  
  return (
    <form onSubmit={handleSubmit} className="flex items-center space-x-2">
      <TextInput placeholder="Bin Code" value={code} onChange={e => setCode(e.target.value)} required />
      <TextInput placeholder="Bin Name" value={name} onChange={e => setName(e.target.value)} />
      <Button type="submit" disabled={loading} size="sm">Save</Button>
      <Button type="button" variant="secondary" size="sm" onClick={() => setIsOpen(false)}>Cancel</Button>
    </form>
  );
}

function AddBinSlideOver({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
  const [warehouses, setWarehouses] = useState<{id: string, primary: string, secondary?: string}[]>([]);
  const [locations, setLocations] = useState<{id: string, primary: string, secondary?: string}[]>([]);
  const [racks, setRacks] = useState<{id: string, primary: string, secondary?: string}[]>([]);

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
      masterDataService.getWarehouses({ pageSize: 1000 }).then(res => {
        setWarehouses(res.data.map(w => ({ id: w.id, primary: w.name, secondary: w.code })));
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
      masterDataService.getLocations({ parentId: selectedWarehouse, pageSize: 1000 }).then(res => {
        setLocations(res.data.map(l => ({ id: l.id, primary: l.name, secondary: l.code })));
      });
      setSelectedLocation(undefined);
      setSelectedRack(undefined);
    } else {
      setLocations([]);
    }
  }, [selectedWarehouse]);

  useEffect(() => {
    if (selectedLocation) {
      masterDataService.getRacks({ parentId: selectedLocation, pageSize: 1000 }).then(res => {
        setRacks(res.data.map(r => ({ id: r.id, primary: r.name, secondary: r.code })));
      });
      setSelectedRack(undefined);
    } else {
      setRacks([]);
    }
  }, [selectedLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return alert('Select location');
    if (!selectedRack && !isCreatingRack) return alert('Select rack or create one');

    setLoading(true);
    try {
      let finalRackId = selectedRack;

      if (isCreatingRack) {
        if (!newRackCode) throw new Error("New rack code required");
        const rack = await masterDataService.createRack({
          locationId: selectedLocation,
          code: newRackCode,
          name: newRackName || newRackCode,
          isActive: true
        });
        finalRackId = rack.id;
      }

      if (!finalRackId) throw new Error("Rack ID is missing");

      await masterDataService.createBin({
        rackId: finalRackId,
        code: binCode,
        name: binCode,
        isActive
      });

      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Add New Bin">
      <form onSubmit={handleSubmit} className="space-y-6">
        
        <FormField label="Warehouse" id="warehouse">
          <SearchSelect
            options={warehouses}
            value={selectedWarehouse}
            onChange={setSelectedWarehouse}
            placeholder="Select Warehouse"
          />
        </FormField>

        {selectedWarehouse && (
          <FormField label="Location" id="location">
            <SearchSelect
              options={locations}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="Select Location"
            />
          </FormField>
        )}

        {selectedLocation && (
          <div className="space-y-4 border p-4 rounded bg-gray-50">
            <div className="flex items-center justify-between">
              <label className="font-medium text-sm text-gray-700">Rack Selection</label>
              <button 
                type="button" 
                className="text-sm text-blue-600 hover:underline"
                onClick={() => setIsCreatingRack(!isCreatingRack)}
              >
                {isCreatingRack ? 'Select Existing Rack' : '+ Create New Rack'}
              </button>
            </div>

            {isCreatingRack ? (
              <div className="grid grid-cols-2 gap-4">
                <FormField label="New Rack Code" id="rack-code" required>
                  <TextInput value={newRackCode} onChange={e => setNewRackCode(e.target.value)} required />
                </FormField>
                <FormField label="New Rack Name" id="rack-name">
                  <TextInput value={newRackName} onChange={e => setNewRackName(e.target.value)} />
                </FormField>
              </div>
            ) : (
              <SearchSelect
                options={racks}
                value={selectedRack}
                onChange={setSelectedRack}
                placeholder="Select Rack"
              />
            )}
          </div>
        )}

        {(selectedRack || isCreatingRack) && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-gray-800">Bin Details</h3>
            <FormField label="Bin Code" id="bin-code" required>
              <TextInput value={binCode} onChange={e => setBinCode(e.target.value)} required />
            </FormField>
            
            <div className="pt-2">
              <Checkbox
                id="is-active"
                label="Is Active?"
                description="Uncheck to hide this bin."
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
              />
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-6">
          <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
          <Button type="submit" disabled={loading || (!selectedRack && !isCreatingRack) || !binCode}>
            {loading ? 'Saving...' : 'Save Bin'}
          </Button>
        </div>
      </form>
    </SlideOver>
  );
}
