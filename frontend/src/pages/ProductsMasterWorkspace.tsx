import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PageHeader,
  DataTable,
  Button,
  FormField,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  SearchSelect,
  StatusBadge,
} from '../components/ui';
import type { ColumnDef, SearchSelectOption } from '../components/ui';
import {
  masterDataService,
} from '../services/masterDataService';
import type {
  Product,
  Category,
  Family,
  Warehouse,
  Location,
  Rack,
  Bin,
} from '../services/masterDataService';
import { api } from '../services/api';
import { MultiSelectFilter } from '../components/ui';
import {
  Plus,
  Database,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Search,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const UOM_OPTIONS = ['MM', 'KG', 'NOS', 'MTR', 'PC', 'SQM', 'LTR'] as const;

export function ProductsMasterWorkspace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Multi-Filter State (Checkboxes for Multi-Select)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedRacks, setSelectedRacks] = useState<string[]>([]);
  const [selectedBins, setSelectedBins] = useState<string[]>([]);
  const [uomFilter, setUomFilter] = useState('');
  const [mslFilter, setMslFilter] = useState(''); // '' | 'MONITORED' | 'UNMONITORED'
  const [statusFilter, setStatusFilter] = useState(''); // '' | 'ACTIVE' | 'INACTIVE'

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const [familyId, setFamilyId] = useState('');
  const [isCustomFamily, setIsCustomFamily] = useState(false);
  const [customFamily, setCustomFamily] = useState('');

  const [uom, setUom] = useState<string>('KG');
  const [msl, setMsl] = useState<number | ''>(0);
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [prodRes, catRes, famRes, whRes, locRes, rackRes, binRes, bal1, bal2, bal3, bal4] =
        await Promise.all([
          masterDataService.getProducts({ pageSize: 1000 }),
          masterDataService.getCategories({ pageSize: 100 }),
          masterDataService.getFamilies({ pageSize: 100 }),
          masterDataService.getWarehouses({ pageSize: 100 }).catch(() => ({ data: [] })),
          masterDataService.getLocations({ pageSize: 100 }).catch(() => ({ data: [] })),
          masterDataService.getRacks({ pageSize: 100 }).catch(() => ({ data: [] })),
          masterDataService.getBins({ pageSize: 100 }).catch(() => ({ data: [] })),
          api.get<any>('/api/inventory/balances?pageSize=100&page=1').catch(() => ({ data: [] })),
          api.get<any>('/api/inventory/balances?pageSize=100&page=2').catch(() => ({ data: [] })),
          api.get<any>('/api/inventory/balances?pageSize=100&page=3').catch(() => ({ data: [] })),
          api.get<any>('/api/inventory/balances?pageSize=100&page=4').catch(() => ({ data: [] })),
        ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setFamilies(famRes.data || []);
      setWarehouses(whRes.data || []);
      setLocations(locRes.data || []);
      setRacks(rackRes.data || []);
      setBins(binRes.data || []);
      const allBalances = [
        ...(bal1.data || []),
        ...(bal2.data || []),
        ...(bal3.data || []),
        ...(bal4.data || []),
      ];
      setBalances(allBalances);
    } catch (err: any) {
      console.error('Failed to load products master data', err);
      setError(err.message || 'Failed to load products master data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingProduct(null);
    setCode('');
    setName('');
    setCategoryId(categories.length > 0 ? categories[0].id : '');
    setIsCustomCategory(false);
    setCustomCategory('');
    setFamilyId('');
    setIsCustomFamily(false);
    setCustomFamily('');
    setUom('KG');
    setMsl(0);
    setIsActive(true);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setCode(product.code || '');
    setName(product.name || '');

    const currentFam = families.find((f) => f.id === product.familyId);
    const currentCatId = currentFam?.categoryId || product.family?.categoryId || '';

    setCategoryId(currentCatId);
    setIsCustomCategory(false);
    setCustomCategory('');

    setFamilyId(product.familyId || '');
    setIsCustomFamily(false);
    setCustomFamily('');

    setUom(product.uom || 'KG');
    setMsl(product.minimumInventory !== undefined ? Number(product.minimumInventory) : 0);
    setIsActive(product.isActive ?? true);
    setFormErrors({});
    setIsModalOpen(true);
  };

  // Options for SearchSelect
  const categoryOptions: SearchSelectOption[] = useMemo(() => {
    return categories.map((c) => ({
      id: c.id,
      primary: c.name,
    }));
  }, [categories]);

  const familyOptions: SearchSelectOption[] = useMemo(() => {
    const list = categoryId
      ? families.filter((f) => f.categoryId === categoryId)
      : families;
    return list.map((f) => ({
      id: f.id,
      primary: f.name,
      secondary: f.category?.name,
    }));
  }, [families, categoryId]);

  // Validation & Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      errors.code = 'Product Code is required';
    }

    const cleanName = name.trim();
    if (!cleanName) {
      errors.name = 'Product Name is required';
    }

    if (isCustomCategory && !customCategory.trim()) {
      errors.category = 'Category name cannot be empty';
    } else if (!isCustomCategory && !categoryId) {
      errors.category = 'Please select a Category';
    }

    if (isCustomFamily && !customFamily.trim()) {
      errors.family = 'Family name cannot be empty';
    } else if (!isCustomFamily && !familyId) {
      errors.family = 'Please select a Product Family';
    }

    if (msl !== '' && Number(msl) < 0) {
      errors.msl = 'Minimum Stock Level cannot be negative';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setIsSaving(true);
      setFormErrors({});

      const payload: any = {
        code: cleanCode,
        name: cleanName,
        uom,
        minimumInventory: msl === '' ? 0 : Number(msl),
        isActive,
      };

      if (isCustomFamily) {
        payload.familyName = customFamily.trim();
        if (isCustomCategory) {
          payload.categoryName = customCategory.trim();
        } else {
          payload.categoryId = categoryId;
        }
      } else {
        payload.familyId = familyId;
      }

      if (editingProduct) {
        await masterDataService.updateProduct(editingProduct.id, payload);
        toast.success(`Product ${cleanCode} updated successfully.`);
      } else {
        await masterDataService.createProduct(payload);
        toast.success(`Product ${cleanCode} created successfully.`);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Failed to save product', err);
      const errMsg = err.message || 'Failed to save product';
      toast.error(errMsg);
      setFormErrors({ submit: errMsg });
    } finally {
      setIsSaving(false);
    }
  };

  // Product Storage Mapping from stock_balances
  const productStorageMap = useMemo(() => {
    const binMap = new Map(bins.map((b) => [b.id, b]));
    const rackMap = new Map(racks.map((r) => [r.id, r]));
    const locMap = new Map(locations.map((l) => [l.id, l]));
    const map = new Map<
      string,
      {
        binIds: Set<string>;
        rackIds: Set<string>;
        locationIds: Set<string>;
        warehouseIds: Set<string>;
        binLabels: string[];
      }
    >();

    for (const bal of balances) {
      if (!bal.productId) continue;
      if (!map.has(bal.productId)) {
        map.set(bal.productId, {
          binIds: new Set(),
          rackIds: new Set(),
          locationIds: new Set(),
          warehouseIds: new Set(),
          binLabels: [],
        });
      }
      const entry = map.get(bal.productId)!;
      if (bal.binId) entry.binIds.add(bal.binId);
      if (bal.binCode && !entry.binLabels.includes(bal.binCode)) {
        entry.binLabels.push(bal.binCode);
      }
      const bin = binMap.get(bal.binId);
      if (bin) {
        if (bin.rackId) {
          entry.rackIds.add(bin.rackId);
          const rack = rackMap.get(bin.rackId);
          if (rack?.locationId) {
            entry.locationIds.add(rack.locationId);
            const loc = locMap.get(rack.locationId);
            if (loc?.warehouseId) {
              entry.warehouseIds.add(loc.warehouseId);
            }
          }
        }
        if (bin.rack?.locationId) {
          entry.locationIds.add(bin.rack.locationId);
          const loc = locMap.get(bin.rack.locationId) || bin.rack.location;
          if (loc?.warehouseId) {
            entry.warehouseIds.add(loc.warehouseId);
          }
        }
      }
    }
    return map;
  }, [balances, bins, racks, locations]);

  // Cascading options based on selected parent filters
  const filteredLocationOptions = useMemo(() => {
    if (selectedWarehouses.length === 0) return locations;
    return locations.filter((loc) => selectedWarehouses.includes(loc.warehouseId));
  }, [locations, selectedWarehouses]);

  const filteredRackOptions = useMemo(() => {
    let result = racks;
    if (selectedWarehouses.length > 0) {
      const allowedLocIds = new Set(
        locations.filter((l) => selectedWarehouses.includes(l.warehouseId)).map((l) => l.id)
      );
      result = result.filter((r) => allowedLocIds.has(r.locationId));
    }
    if (selectedLocations.length > 0) {
      result = result.filter((r) => selectedLocations.includes(r.locationId));
    }
    return result;
  }, [racks, locations, selectedWarehouses, selectedLocations]);

  const filteredBinOptions = useMemo(() => {
    let result = bins;
    if (selectedRacks.length > 0) {
      return result.filter((b) => selectedRacks.includes(b.rackId));
    }
    if (selectedLocations.length > 0) {
      const allowedRackIds = new Set(
        racks.filter((r) => selectedLocations.includes(r.locationId)).map((r) => r.id)
      );
      return result.filter((b) => allowedRackIds.has(b.rackId));
    }
    return result;
  }, [bins, racks, selectedRacks, selectedLocations]);

  // Multi-Filter Computation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = p.code?.toLowerCase().includes(q);
        const nameMatch = p.name?.toLowerCase().includes(q);
        const catMatch = (p.family?.category?.name || '').toLowerCase().includes(q);
        const famMatch = (p.family?.name || '').toLowerCase().includes(q);
        const uomMatch = (p.uom || '').toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !catMatch && !famMatch && !uomMatch) return false;
      }
      // 2. Category Filter (multi-select)
      if (selectedCategories.length > 0) {
        const pCatId = p.family?.categoryId || p.family?.category?.id;
        if (!pCatId || !selectedCategories.includes(pCatId)) return false;
      }
      // 3. Product Family Filter (multi-select)
      if (selectedFamilies.length > 0) {
        const famId = p.familyId || p.family?.id;
        if (!famId || !selectedFamilies.includes(famId)) return false;
      }
      // 4. Warehouse Filter (multi-select)
      if (selectedWarehouses.length > 0) {
        const storage = productStorageMap.get(p.id);
        if (!storage || !selectedWarehouses.some((whId) => storage.warehouseIds.has(whId))) {
          return false;
        }
      }
      // 5. Storage Location Filter (multi-select)
      if (selectedLocations.length > 0) {
        const storage = productStorageMap.get(p.id);
        if (!storage || !selectedLocations.some((locId) => storage.locationIds.has(locId))) {
          return false;
        }
      }
      // 6. Rack Filter (multi-select)
      if (selectedRacks.length > 0) {
        const storage = productStorageMap.get(p.id);
        if (!storage || !selectedRacks.some((rackId) => storage.rackIds.has(rackId))) {
          return false;
        }
      }
      // 7. Bin Filter (multi-select)
      if (selectedBins.length > 0) {
        const storage = productStorageMap.get(p.id);
        if (!storage || !selectedBins.some((binId) => storage.binIds.has(binId))) {
          return false;
        }
      }
      // 8. UOM Filter
      if (uomFilter && p.uom !== uomFilter) {
        return false;
      }
      // 9. MSL Filter
      if (mslFilter === 'MONITORED' && (!p.minimumInventory || Number(p.minimumInventory) <= 0)) {
        return false;
      }
      if (mslFilter === 'UNMONITORED' && p.minimumInventory && Number(p.minimumInventory) > 0) {
        return false;
      }
      // 10. Active Status Filter
      if (statusFilter === 'ACTIVE' && !p.isActive) return false;
      if (statusFilter === 'INACTIVE' && p.isActive) return false;

      return true;
    });
  }, [
    products,
    searchQuery,
    selectedCategories,
    selectedFamilies,
    selectedWarehouses,
    selectedLocations,
    selectedRacks,
    selectedBins,
    uomFilter,
    mslFilter,
    statusFilter,
    productStorageMap,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchQuery.trim()) count++;
    if (selectedCategories.length > 0) count++;
    if (selectedFamilies.length > 0) count++;
    if (selectedWarehouses.length > 0) count++;
    if (selectedLocations.length > 0) count++;
    if (selectedRacks.length > 0) count++;
    if (selectedBins.length > 0) count++;
    if (uomFilter) count++;
    if (mslFilter) count++;
    if (statusFilter) count++;
    return count;
  }, [
    searchQuery,
    selectedCategories,
    selectedFamilies,
    selectedWarehouses,
    selectedLocations,
    selectedRacks,
    selectedBins,
    uomFilter,
    mslFilter,
    statusFilter,
  ]);

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategories([]);
    setSelectedFamilies([]);
    setSelectedWarehouses([]);
    setSelectedLocations([]);
    setSelectedRacks([]);
    setSelectedBins([]);
    setUomFilter('');
    setMslFilter('');
    setStatusFilter('');
  };

  // Table Columns
  const columns: ColumnDef<Product>[] = useMemo(
    () => [
      {
        key: 'code',
        header: 'Code',
        sortable: true,
        render: (row) => (
          <span className="font-mono font-medium text-gray-900">
            {row.code || '—'}
          </span>
        ),
      },
      {
        key: 'name',
        header: 'Product Name',
        sortable: true,
        render: (row) => (
          <span className="font-medium text-gray-900">{row.name}</span>
        ),
      },
      {
        key: 'category',
        header: 'Category',
        sortable: true,
        render: (row) => (
          <span className="text-gray-600">
            {row.family?.category?.name || '—'}
          </span>
        ),
      },
      {
        key: 'family',
        header: 'Family',
        sortable: true,
        render: (row) => (
          <span className="text-gray-600">{row.family?.name || '—'}</span>
        ),
      },
      {
        key: 'storageBin',
        header: 'Bin Location',
        render: (row) => {
          const storage = productStorageMap.get(row.id);
          if (!storage || storage.binLabels.length === 0) {
            return <span className="text-xs text-slate-400 italic">Unassigned</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1 max-w-[160px]">
              {storage.binLabels.slice(0, 2).map((bCode) => (
                <span
                  key={bCode}
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {bCode}
                </span>
              ))}
              {storage.binLabels.length > 2 && (
                <span className="text-[10px] text-slate-500 font-medium">
                  +{storage.binLabels.length - 2}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'uom',
        header: 'UOM',
        sortable: true,
        render: (row) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            {row.uom || 'KG'}
          </span>
        ),
      },
      {
        key: 'minimumInventory',
        header: 'MSL (Min Stock)',
        isNumeric: true,
        sortable: true,
        render: (row) => {
          const mslVal = Number(row.minimumInventory) || 0;
          return mslVal > 0 ? (
            <span className="font-semibold text-gray-900 tabular-nums">
              {mslVal.toLocaleString()} {row.uom || 'KG'}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">Not Monitored</span>
          );
        },
      },
      {
        key: 'isActive',
        header: 'Status',
        sortable: true,
        render: (row) => (
          <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
        ),
      },
    ],
    [productStorageMap],
  );

  return (
    <div className="p-6 space-y-6">
      {isModalOpen ? (
        <div className="max-w-4xl mx-auto w-full pb-12">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-xs transition-all hover:bg-slate-50 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Products List</span>
            </button>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {editingProduct ? 'Editing Existing Product' : 'Creating New Product'}
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/70 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingProduct ? 'Edit Product & MSL' : 'Create New Product'}
                </h2>
                <p className="text-xs text-slate-500">
                  Configure product identification, category mapping, and stock alert thresholds.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6 p-6">
              {formErrors.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formErrors.submit}</span>
                </div>
              )}

              {/* Basic Information Section */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Product Identification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Product Code */}
                  <FormField
                    label="Product Code"
                    id="product-code"
                    required
                    error={formErrors.code}
                    hint="Unique identifier (auto-converted to UPPERCASE)."
                  >
                    <TextInput
                      id="product-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. EN31-ROD-100"
                      error={!!formErrors.code}
                      required
                    />
                  </FormField>

                  {/* Product Name */}
                  <FormField
                    label="Product Name"
                    id="product-name"
                    required
                    error={formErrors.name}
                    hint="Descriptive name of the raw material or component."
                  >
                    <TextInput
                      id="product-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. EN31 Round Bar Ø100mm"
                      error={!!formErrors.name}
                      required
                    />
                  </FormField>
                </div>
              </div>

              {/* Categorization Section */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Category & Classification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Category */}
                  <FormField
                    label="Category"
                    required
                    error={formErrors.category}
                    hint={
                      isCustomCategory
                        ? 'Enter a new category name.'
                        : 'Select existing category or type a new one.'
                    }
                  >
                    {isCustomCategory ? (
                      <div className="space-y-1.5">
                        <TextInput
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="New Category Name (e.g. Raw Material)"
                          error={!!formErrors.category}
                        />
                        <button
                          type="button"
                          onClick={() => setIsCustomCategory(false)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          ← Select existing category
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <SearchSelect
                          value={categoryId}
                          onChange={(id) => {
                            setCategoryId(id);
                            setFamilyId(''); // reset family on category change
                          }}
                          options={categoryOptions}
                          placeholder="Choose Category..."
                          error={!!formErrors.category}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomCategory(true);
                            setIsCustomFamily(true);
                          }}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          + Type new category
                        </button>
                      </div>
                    )}
                  </FormField>

                  {/* Product Family */}
                  <FormField
                    label="Product Family"
                    required
                    error={formErrors.family}
                    hint={
                      isCustomFamily
                        ? 'Enter a new product family name.'
                        : 'Select existing product family or type a new one.'
                    }
                  >
                    {isCustomFamily ? (
                      <div className="space-y-1.5">
                        <TextInput
                          value={customFamily}
                          onChange={(e) => setCustomFamily(e.target.value)}
                          placeholder="New Family Name (e.g. Alloy Steel)"
                          error={!!formErrors.family}
                        />
                        {!isCustomCategory && (
                          <button
                            type="button"
                            onClick={() => setIsCustomFamily(false)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            ← Select existing family
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <SearchSelect
                          value={familyId}
                          onChange={(id) => setFamilyId(id)}
                          options={familyOptions}
                          placeholder={
                            categoryId
                              ? 'Choose Family under Category...'
                              : 'Choose Family...'
                          }
                          error={!!formErrors.family}
                        />
                        <button
                          type="button"
                          onClick={() => setIsCustomFamily(true)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          + Type new family
                        </button>
                      </div>
                    )}
                  </FormField>
                </div>
              </div>

              {/* Inventory Thresholds Section */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Inventory & Stock Thresholds
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* UOM */}
                  <FormField label="Unit of Measurement (UOM)" required>
                    <Select
                      value={uom}
                      onChange={(e) => setUom(e.target.value)}
                    >
                      {UOM_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  {/* Minimum Stock Level (MSL) */}
                  <FormField
                    label="Minimum Stock Level (MSL)"
                    error={formErrors.msl}
                    hint="0 = not monitored for low-stock alerts"
                  >
                    <NumberInput
                      value={msl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMsl(val === '' ? '' : Number(val));
                      }}
                      min={0}
                      unit={uom}
                      placeholder="0"
                      error={!!formErrors.msl}
                    />
                  </FormField>
                </div>
              </div>

              {/* Active status */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200">
                <Checkbox
                  id="product-is-active"
                  label="Active Product Status"
                  description="Inactive products cannot be selected in new RM requisitions or Delivery Challan dispatches."
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
              </div>

              {/* Form Actions */}
              <div className="mt-8 pt-5 border-t border-slate-200 flex justify-end space-x-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving
                    ? 'Saving...'
                    : editingProduct
                    ? 'Update Product'
                    : 'Create Product'}
                </Button>
              </div>
            </form>
          </div>
        </div>
  ) : (
    <>
      <PageHeader
        title="Products Master & MSL"
        subtitle="Manage product definitions, specifications, UOMs, and Minimum Stock Levels (MSL)."
        breadcrumbs={<span>Masters / Products</span>}
      />

      {/* Aligned Search & Multi-Filter Toolbar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        {/* Row 1: Aligned Search Bar & Primary Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by code, name, category, family, or specification..."
              className="w-full h-10 pl-10 pr-9 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 shadow-xs transition-colors hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <Button
              variant="secondary"
              onClick={loadData}
              disabled={isLoading}
              title="Refresh list"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              />
            </Button>
            <Button onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Product
            </Button>
          </div>
        </div>

        {/* Row 2: Multiple Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters:</span>
          </div>

          {/* Category Multi-Filter */}
          <MultiSelectFilter
            label="Category"
            placeholder="All Categories"
            options={categories.map((c) => ({ id: c.id, label: c.name }))}
            selectedValues={selectedCategories}
            onChange={setSelectedCategories}
          />

          {/* Product Family Multi-Filter */}
          <MultiSelectFilter
            label="Family"
            placeholder="All Families"
            options={families.map((f) => ({ id: f.id, label: f.name, subtext: f.category?.name }))}
            selectedValues={selectedFamilies}
            onChange={setSelectedFamilies}
          />

          {/* Warehouse Facility Multi-Filter */}
          <MultiSelectFilter
            label="Warehouse"
            placeholder="All Warehouses"
            options={warehouses.map((w) => ({ id: w.id, label: w.name, subtext: w.code }))}
            selectedValues={selectedWarehouses}
            onChange={setSelectedWarehouses}
          />

          {/* Storage Location Multi-Filter */}
          <MultiSelectFilter
            label="Location"
            placeholder="All Locations"
            options={filteredLocationOptions.map((l) => ({ id: l.id, label: l.name, subtext: l.code }))}
            selectedValues={selectedLocations}
            onChange={setSelectedLocations}
          />

          {/* Storage Rack Multi-Filter */}
          <MultiSelectFilter
            label="Rack"
            placeholder="All Racks"
            options={filteredRackOptions.map((r) => ({ id: r.id, label: r.name, subtext: r.code }))}
            selectedValues={selectedRacks}
            onChange={setSelectedRacks}
          />

          {/* Storage Bin Multi-Filter */}
          <MultiSelectFilter
            label="Bin"
            placeholder="All Bins"
            options={filteredBinOptions.map((b) => ({ id: b.id, label: b.code, subtext: b.name }))}
            selectedValues={selectedBins}
            onChange={setSelectedBins}
          />

          {/* UOM Filter */}
          <select
            value={uomFilter}
            onChange={(e) => setUomFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="">All UOMs</option>
            {UOM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          {/* MSL Status Filter */}
          <select
            value={mslFilter}
            onChange={(e) => setMslFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="">All MSL Monitoring</option>
            <option value="MONITORED">Monitored Items (MSL &gt; 0)</option>
            <option value="UNMONITORED">Not Monitored</option>
          </select>

          {/* Active Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:border-slate-400 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* Active Filters Reset Button */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 font-medium transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters ({activeFilterCount})</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredProducts}
          isLoading={isLoading}
          isError={!!error}
          errorMsg={error || undefined}
          onRetry={loadData}
          onRowClick={openEditModal}
          searchable={false}
          pagination={true}
          defaultPageSize={15}
        />
      </div>
    </>
  )}
</div>
);
}
