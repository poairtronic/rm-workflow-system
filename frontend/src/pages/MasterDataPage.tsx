import React, { useState, useEffect } from 'react';
import { masterDataService } from '../services/masterDataService';
import type {
  Category,
  Family,
  Product,
  Warehouse,
  Location,
  Rack,
  Bin,
} from '../services/masterDataService';
import { Button } from '../components/ui/Button';

type MasterTab = 'categories' | 'families' | 'products' | 'warehouses' | 'locations' | 'racks' | 'bins';

export const MasterDataPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<MasterTab>('categories');
  const [search, setSearch] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { search, isActive: isActiveFilter, pageSize: 50 };
      if (activeTab === 'categories') {
        const res = await masterDataService.getCategories(params);
        setCategories(res.data);
      } else if (activeTab === 'families') {
        const res = await masterDataService.getFamilies(params);
        setFamilies(res.data);
      } else if (activeTab === 'products') {
        const res = await masterDataService.getProducts(params);
        setProducts(res.data);
      } else if (activeTab === 'warehouses') {
        const res = await masterDataService.getWarehouses(params);
        setWarehouses(res.data);
      } else if (activeTab === 'locations') {
        const res = await masterDataService.getLocations(params);
        setLocations(res.data);
      } else if (activeTab === 'racks') {
        const res = await masterDataService.getRacks(params);
        setRacks(res.data);
      } else if (activeTab === 'bins') {
        const res = await masterDataService.getBins(params);
        setBins(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load master data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, search, isActiveFilter]);

  const handleOpenCreateModal = async () => {
    setEditingItem(null);
    setFormData({ isActive: true });
    // Preload parent options if needed
    try {
      if (activeTab === 'families' || activeTab === 'products') {
        const cats = await masterDataService.getCategories({ pageSize: 100 });
        setCategories(cats.data);
        const fams = await masterDataService.getFamilies({ pageSize: 100 });
        setFamilies(fams.data);
      } else if (activeTab === 'locations' || activeTab === 'racks' || activeTab === 'bins') {
        const whs = await masterDataService.getWarehouses({ pageSize: 100 });
        setWarehouses(whs.data);
        const locs = await masterDataService.getLocations({ pageSize: 100 });
        setLocations(locs.data);
        const rks = await masterDataService.getRacks({ pageSize: 100 });
        setRacks(rks.data);
      }
    } catch (e) {
      // ignore
    }
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    try {
      if (activeTab === 'families' || activeTab === 'products') {
        const cats = await masterDataService.getCategories({ pageSize: 100 });
        setCategories(cats.data);
        const fams = await masterDataService.getFamilies({ pageSize: 100 });
        setFamilies(fams.data);
      } else if (activeTab === 'locations' || activeTab === 'racks' || activeTab === 'bins') {
        const whs = await masterDataService.getWarehouses({ pageSize: 100 });
        setWarehouses(whs.data);
        const locs = await masterDataService.getLocations({ pageSize: 100 });
        setLocations(locs.data);
        const rks = await masterDataService.getRacks({ pageSize: 100 });
        setRacks(rks.data);
      }
    } catch (e) {
      // ignore
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (activeTab === 'categories') {
        if (editingItem) {
          await masterDataService.updateCategory(editingItem.id, formData);
        } else {
          await masterDataService.createCategory(formData);
        }
      } else if (activeTab === 'families') {
        if (editingItem) {
          await masterDataService.updateFamily(editingItem.id, formData);
        } else {
          await masterDataService.createFamily(formData);
        }
      } else if (activeTab === 'products') {
        if (editingItem) {
          await masterDataService.updateProduct(editingItem.id, formData);
        } else {
          await masterDataService.createProduct(formData);
        }
      } else if (activeTab === 'warehouses') {
        if (editingItem) {
          await masterDataService.updateWarehouse(editingItem.id, formData);
        } else {
          await masterDataService.createWarehouse(formData);
        }
      } else if (activeTab === 'locations') {
        if (editingItem) {
          await masterDataService.updateLocation(editingItem.id, formData);
        } else {
          await masterDataService.createLocation(formData);
        }
      } else if (activeTab === 'racks') {
        if (editingItem) {
          await masterDataService.updateRack(editingItem.id, formData);
        } else {
          await masterDataService.createRack(formData);
        }
      } else if (activeTab === 'bins') {
        if (editingItem) {
          await masterDataService.updateBin(editingItem.id, formData);
        } else {
          await masterDataService.createBin(formData);
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save master data.');
    }
  };

  const handleToggleActive = async (item: any) => {
    try {
      const nextActive = !item.isActive;
      if (activeTab === 'categories') await masterDataService.updateCategory(item.id, { isActive: nextActive });
      else if (activeTab === 'families') await masterDataService.updateFamily(item.id, { isActive: nextActive });
      else if (activeTab === 'products') await masterDataService.updateProduct(item.id, { isActive: nextActive });
      else if (activeTab === 'warehouses') await masterDataService.updateWarehouse(item.id, { isActive: nextActive });
      else if (activeTab === 'locations') await masterDataService.updateLocation(item.id, { isActive: nextActive });
      else if (activeTab === 'racks') await masterDataService.updateRack(item.id, { isActive: nextActive });
      else if (activeTab === 'bins') await masterDataService.updateBin(item.id, { isActive: nextActive });
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update active state.');
    }
  };

  return (
    <div className="page-container" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Master Data Management</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Manage Categories, Families, Products, Warehouses, Locations, Racks, and Bins.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal} variant="primary">
          + Add New {activeTab.slice(0, -1).toUpperCase()}
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e5e7eb', marginBottom: '1rem' }}>
        {(
          [
            ['categories', 'Categories'],
            ['families', 'Families'],
            ['products', 'Products'],
            ['warehouses', 'Warehouses'],
            ['locations', 'Locations'],
            ['racks', 'Racks'],
            ['bins', 'Bins'],
          ] as [MasterTab, string][]
        ).map(([tabKey, label]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tabKey ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === tabKey ? '#2563eb' : '#4b5563',
              fontWeight: activeTab === tabKey ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db', width: '250px' }}
        />
        <select
          value={isActiveFilter === undefined ? 'all' : isActiveFilter ? 'active' : 'inactive'}
          onChange={(e) => {
            const val = e.target.value;
            setIsActiveFilter(val === 'all' ? undefined : val === 'active');
          }}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: '4px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading {activeTab}...</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '6px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 1rem' }}>Code / Identifier</th>
                <th style={{ padding: '0.75rem 1rem' }}>Name</th>
                <th style={{ padding: '0.75rem 1rem' }}>Parent / Context</th>
                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeTab === 'categories' &&
                categories.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>-</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>Root Category</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'families' &&
                families.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>-</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.category?.name || 'Category'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'products' &&
                products.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem' }}>-</td>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.family?.name || 'Family'} (Min: {item.minimumInventory}, Max: {item.maximumInventory ?? '∞'})</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'warehouses' &&
                warehouses.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.code}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>Root Warehouse</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'locations' &&
                locations.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.code}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.warehouse?.name || 'Warehouse'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'racks' &&
                racks.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.code}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.location?.name || 'Location'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}

              {activeTab === 'bins' &&
                bins.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{item.code}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.name}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>{item.rack?.name || 'Rack'}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <span style={{ padding: '0.25rem 0.5rem', borderRadius: '12px', fontSize: '0.75rem', background: item.isActive ? '#dcfce7' : '#f3f4f6', color: item.isActive ? '#166534' : '#374151' }}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(item)} style={{ marginRight: '0.5rem' }}>Edit</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleToggleActive(item)}>{item.isActive ? 'Deactivate' : 'Reactivate'}</Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <form onSubmit={handleSave} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h2 style={{ marginTop: 0, fontSize: '1.25rem' }}>
              {editingItem ? 'Edit' : 'Add'} {activeTab.slice(0, -1).toUpperCase()}
            </h2>

            {(activeTab === 'warehouses' || activeTab === 'locations' || activeTab === 'racks' || activeTab === 'bins') && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Code</label>
                <input
                  type="text"
                  required
                  value={formData.code || ''}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Name</label>
              <input
                type="text"
                required
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>

            {activeTab === 'families' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Category</label>
                <select
                  required
                  value={formData.categoryId || ''}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'products' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Family</label>
                  <select
                    required
                    value={formData.familyId || ''}
                    onChange={(e) => setFormData({ ...formData, familyId: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  >
                    <option value="">Select Family</option>
                    {families.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Min Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.minimumInventory ?? 0}
                      onChange={(e) => setFormData({ ...formData, minimumInventory: Number(e.target.value) })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Max Stock</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.maximumInventory ?? ''}
                      onChange={(e) => setFormData({ ...formData, maximumInventory: e.target.value ? Number(e.target.value) : undefined })}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'locations' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Warehouse</label>
                <select
                  required
                  value={formData.warehouseId || ''}
                  onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select Warehouse</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'racks' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Location</label>
                <select
                  required
                  value={formData.locationId || ''}
                  onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select Location</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeTab === 'bins' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem' }}>Rack</label>
                <select
                  required
                  value={formData.rackId || ''}
                  onChange={(e) => setFormData({ ...formData, rackId: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">Select Rack</option>
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
