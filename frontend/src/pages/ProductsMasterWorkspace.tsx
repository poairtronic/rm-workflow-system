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
  ConfirmDialog,
  Modal,
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
import { inventoryService } from '../services/inventoryService';
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
  Edit2,
  Trash2,
  Printer,
  Barcode as BarcodeIcon,
  CheckSquare,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BarcodeBadge } from '../components/inventory/BarcodeBadge';
import { BarcodeLabelModal } from '../components/inventory/BarcodeLabelModal';
import { BarcodeSvg } from '../components/common/BarcodeSvg';
import { ExportDropdown } from '../components/common/ExportDropdown';
import type { ExportColumn } from '../utils/exportUtils';

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
  const [deleteProductTarget, setDeleteProductTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Barcode Label Printing & Bulk Selection State
  const [printModalProducts, setPrintModalProducts] = useState<Product[] | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Form Fields
  const [code, setCode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  const [familyId, setFamilyId] = useState('');
  const [isCustomFamily, setIsCustomFamily] = useState(false);
  const [customFamily, setCustomFamily] = useState('');

  // Quick Category / Family Creation Modals
  const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [quickCategoryError, setQuickCategoryError] = useState<string | null>(null);

  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyCategoryId, setNewFamilyCategoryId] = useState('');
  const [isCreatingFamily, setIsCreatingFamily] = useState(false);
  const [quickFamilyError, setQuickFamilyError] = useState<string | null>(null);

  const [uom, setUom] = useState<string>('KG');
  const [msl, setMsl] = useState<number | ''>(0);
  const [isActive, setIsActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [prodRes, catRes, famRes, whRes, locRes, rackRes, binRes, balRes] =
        await Promise.all([
           masterDataService.getProducts({ pageSize: 1000 }),
           masterDataService.getCategories({ pageSize: 100 }),
           masterDataService.getFamilies({ pageSize: 100 }),
           masterDataService.getWarehouses({ pageSize: 100 }).catch(() => ({ data: [] })),
           masterDataService.getLocations({ pageSize: 100 }).catch(() => ({ data: [] })),
           masterDataService.getRacks({ pageSize: 1000 }).catch(() => ({ data: [] })),
           masterDataService.getBins({ pageSize: 1000 }).catch(() => ({ data: [] })),
           inventoryService.getAllBalances({ page: 1, pageSize: 2000 }).catch(() => ({ data: [] })),
         ]);
       const loadedProducts = prodRes.data || [];
       setProducts(loadedProducts);
       setCategories(catRes.data || []);
       setFamilies(famRes.data || []);
       setWarehouses(whRes.data || []);
       setLocations(locRes.data || []);
       setRacks(rackRes.data || []);
       setBins(binRes.data || []);
       setBalances(balRes.data || []);

       // Proactively ensure 100% of products have valid barcodes linked
       const missingBarcodes = loadedProducts.filter((p: Product) => !p.barcode);
       if (missingBarcodes.length > 0) {
         masterDataService.backfillBarcodes().then((res) => {
           if (res.count > 0) {
             masterDataService.getProducts({ pageSize: 500 }).then((refreshed) => {
               if (refreshed.data) setProducts(refreshed.data);
             }).catch(() => {});
           }
         }).catch(() => {});
       }
    } catch (err: any) {
      console.error('Failed to load products master data', err);
      setError(err.message || 'Failed to load products master data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const [isBackfilling, setIsBackfilling] = useState(false);

  const handleBackfillAllBarcodes = async () => {
    try {
      setIsBackfilling(true);
      const res = await masterDataService.backfillBarcodes();
      toast.success(res.message || 'Successfully linked barcodes for all products!');
      await loadData();
    } catch (err: any) {
      toast.error('Failed to auto-assign barcodes: ' + (err.message || 'Unknown error'));
    } finally {
      setIsBackfilling(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const computeNextProductCode = useCallback((): string => {
    let maxNum = 0;
    for (const p of products) {
      if (p.code) {
        const match = p.code.match(/^RM\s*[-_]?\s*(\d+)$/i);
        if (match) {
          const val = parseInt(match[1], 10);
          if (!isNaN(val) && val > maxNum) {
            maxNum = val;
          }
        }
      }
    }
    const nextVal = maxNum + 1;
    return `RM-${String(nextVal).padStart(4, '0')}`;
  }, [products]);

  // Auto-generate or re-sync barcode with product code
  const handleRegenerateBarcode = async (targetCode?: string) => {
    const activeCode = (targetCode || code || '').trim().toUpperCase();
    try {
      const serverBarcode = await masterDataService.getNextBarcode(activeCode);
      if (serverBarcode) {
        setBarcode(serverBarcode);
        return;
      }
    } catch {}
    if (activeCode) {
      setBarcode(activeCode.startsWith('PRD-') ? activeCode : `PRD-${activeCode}`);
    } else {
      setBarcode('PRD-000001');
    }
  };

  // Open Create Modal
  const openCreateModal = async () => {
    setEditingProduct(null);
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

    // Initial instant fallback so user immediately sees next sequential code & barcode
    const initialCode = computeNextProductCode();
    setCode(initialCode);
    const initialBarcode = initialCode ? (initialCode.startsWith('PRD-') ? initialCode : `PRD-${initialCode}`) : 'PRD-000001';
    setBarcode(initialBarcode);

    // Query server for authoritative next unique code & barcode
    try {
      const serverCode = await masterDataService.getNextProductCode();
      if (serverCode) {
        setCode(serverCode);
        try {
          const serverBarcode = await masterDataService.getNextBarcode(serverCode);
          setBarcode(serverBarcode || (serverCode.startsWith('PRD-') ? serverCode : `PRD-${serverCode}`));
        } catch {
          setBarcode(serverCode.startsWith('PRD-') ? serverCode : `PRD-${serverCode}`);
        }
      }
    } catch (err) {
      console.warn('Could not fetch next product code from server, using local sequence', err);
    }
  };

  const handleRegenerateCode = async () => {
    let nextCode = '';
    try {
      const serverCode = await masterDataService.getNextProductCode();
      if (serverCode) {
        nextCode = serverCode;
      }
    } catch {}
    if (!nextCode) {
      nextCode = computeNextProductCode();
    }
    setCode(nextCode);
    await handleRegenerateBarcode(nextCode);
  };

  // Open Edit Modal
  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setCode(product.code || '');
    setBarcode(product.barcode || '');
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

  // Quick Creation Actions
  const handleOpenCreateCategoryModal = (initialName = '') => {
    setNewCategoryName(initialName);
    setQuickCategoryError(null);
    setIsCreateCategoryModalOpen(true);
  };

  const handleSubmitCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      setQuickCategoryError('Category name is required');
      return;
    }

    try {
      setIsCreatingCategory(true);
      setQuickCategoryError(null);

      const created = await masterDataService.createCategory({ name: cleanName });
      toast.success(`Category "${cleanName}" created!`);

      // Update state and select the new category
      setCategories((prev) => {
        const exists = prev.some((c) => c.id === created.id);
        return exists ? prev : [...prev, created];
      });
      setCategoryId(created.id);
      setFamilyId('');
      setIsCustomCategory(false);
      setIsCreateCategoryModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create category', err);
      setQuickCategoryError(err?.message || 'Failed to create category');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const handleOpenCreateFamilyModal = (initialName = '') => {
    setNewFamilyName(initialName);
    setNewFamilyCategoryId(categoryId || (categories.length > 0 ? categories[0].id : ''));
    setQuickFamilyError(null);
    setIsCreateFamilyModalOpen(true);
  };

  const handleSubmitCreateFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFamilyName.trim();
    const targetCatId = newFamilyCategoryId || categoryId;

    if (!targetCatId) {
      setQuickFamilyError('Please select a parent Category');
      return;
    }
    if (!cleanName) {
      setQuickFamilyError('Family name is required');
      return;
    }

    try {
      setIsCreatingFamily(true);
      setQuickFamilyError(null);

      const created = await masterDataService.createFamily({
        categoryId: targetCatId,
        name: cleanName,
      });
      toast.success(`Product Family "${cleanName}" created!`);

      // Update state and select the new family
      setFamilies((prev) => {
        const exists = prev.some((f) => f.id === created.id);
        return exists ? prev : [...prev, created];
      });
      setCategoryId(targetCatId);
      setFamilyId(created.id);
      setIsCustomFamily(false);
      setIsCreateFamilyModalOpen(false);
    } catch (err: any) {
      console.error('Failed to create family', err);
      setQuickFamilyError(err?.message || 'Failed to create product family');
    } finally {
      setIsCreatingFamily(false);
    }
  };

  // Validation & Submit
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    let cleanCode = code.trim().toUpperCase();
    if (!cleanCode && !editingProduct) {
      cleanCode = computeNextProductCode();
      setCode(cleanCode);
    }

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
        barcode: barcode.trim() || undefined,
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

  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    try {
      setIsDeleting(true);
      const res = await masterDataService.deleteProduct(deleteProductTarget.id);
      toast.success(res?.message || `Product ${deleteProductTarget.name} deleted successfully.`);
      setDeleteProductTarget(null);
      await loadData();
    } catch (err: any) {
      console.error('Failed to delete product', err);
      toast.error(err?.message || 'Failed to delete product');
      setDeleteProductTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.size === 0) return;
    setIsBulkDeleting(true);
    let successCount = 0;
    let failedCount = 0;

    const idsToDelete = Array.from(selectedProductIds);
    for (const id of idsToDelete) {
      const prod = products.find((p) => p.id === id);
      const prodName = prod?.name || id;
      try {
        await masterDataService.deleteProduct(id);
        successCount++;
      } catch (err: any) {
        failedCount++;
        console.warn(`Failed to delete product ${prodName}:`, err);
      }
    }

    if (successCount > 0) {
      toast.success(`Successfully deleted ${successCount} product(s).`);
    }
    if (failedCount > 0) {
      toast.error(
        `${failedCount} product(s) could not be deleted (e.g. have historical transactions or active stock).`,
        { duration: 5000 },
      );
    }

    setIsBulkDeleteConfirmOpen(false);
    setIsBulkDeleting(false);
    setSelectedProductIds(new Set());
    setIsSelectionMode(false);
    await loadData();
  };

  // Quick lookup maps
  const binMap = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins]);
  const rackMap = useMemo(() => new Map(racks.map((r) => [r.id, r])), [racks]);
  const locMap = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Product Storage Mapping from stock_balances
  const productStorageMap = useMemo(() => {
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
      
      const bin = binMap.get(bal.binId);
      const bLocationId = (bal as any).locationId || (bin?.rackId ? rackMap.get(bin.rackId)?.locationId : null);
      const bRackId = (bal as any).rackId || bin?.rackId;
      const bWarehouseId = (bal as any).warehouseId || (bLocationId ? locMap.get(bLocationId)?.warehouseId : null);

      if (bRackId) entry.rackIds.add(bRackId);
      if (bLocationId) entry.locationIds.add(bLocationId);
      if (bWarehouseId) entry.warehouseIds.add(bWarehouseId);

      const loc = bLocationId ? locMap.get(bLocationId) : null;
      const isBinArea = loc ? loc.name.toLowerCase().includes('bin') : false;
      const primaryLabel = isBinArea 
        ? (bal.binCode || bin?.code) 
        : (bal.rackCode || (bRackId ? rackMap.get(bRackId)?.code : null) || bal.binCode || bin?.code);

      if (primaryLabel && !entry.binLabels.includes(primaryLabel)) {
        entry.binLabels.push(primaryLabel);
      }
    }
    return map;
  }, [balances, bins, racks, locations, binMap, rackMap, locMap]);

  // Cascading options based on selected parent filters
  const filteredLocationOptions = useMemo(() => {
    if (selectedWarehouses.length === 0) return locations;
    return locations.filter((loc) => selectedWarehouses.includes(loc.warehouseId));
  }, [locations, selectedWarehouses]);

  const filteredRackOptions = useMemo(() => {
    let result = racks.filter((r) => !r.code.startsWith('BIN-') && !r.code.startsWith('BIN '));
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
    let result = bins.filter((b) => {
      const rack = rackMap.get(b.rackId);
      const loc = rack ? locMap.get(rack.locationId) : null;
      return (
        b.code.startsWith('BIN') ||
        b.code.startsWith('BOX') ||
        b.code === 'BLUE BOX' ||
        b.code === 'NONE' ||
        (loc && (
          loc.code === 'BIN-AREA' ||
          loc.code === 'LOC-BINS' ||
          loc.name.toLowerCase().includes('bin') ||
          loc.name.toLowerCase().includes('box')
        ))
      );
    });

    if (selectedLocations.length > 0) {
      const allowedRackIds = new Set(
        racks.filter((r) => selectedLocations.includes(r.locationId)).map((r) => r.id)
      );
      return result.filter((b) => allowedRackIds.has(b.rackId));
    }
    if (selectedWarehouses.length > 0) {
      return result.filter((b) => {
        const rack = rackMap.get(b.rackId);
        const loc = rack ? locMap.get(rack.locationId) : null;
        return loc && selectedWarehouses.includes(loc.warehouseId);
      });
    }
    return result;
  }, [bins, racks, rackMap, locMap, selectedLocations, selectedWarehouses]);

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
  const columns: ColumnDef<Product>[] = useMemo(() => {
    const cols: ColumnDef<Product>[] = [];

    if (isSelectionMode) {
      cols.push({
        key: 'select',
        header: (
          <input
            type="checkbox"
            checked={
              filteredProducts.length > 0 &&
              filteredProducts.every((p) => selectedProductIds.has(p.id))
            }
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
              } else {
                setSelectedProductIds(new Set());
              }
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
            title="Select all products"
          />
        ),
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedProductIds.has(row.id)}
            onChange={(e) => {
              e.stopPropagation();
              const next = new Set(selectedProductIds);
              if (next.has(row.id)) next.delete(row.id);
              else next.add(row.id);
              setSelectedProductIds(next);
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
          />
        ),
      });
    }

    cols.push(
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
        key: 'barcode',
        header: 'Barcode',
        sortable: true,
        render: (row) => (
          <BarcodeBadge
            product={row}
            onPrint={(prod) => setPrintModalProducts([prod])}
          />
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
        header: 'Warehouse Location',
        render: (row) => {
          const storage = productStorageMap.get(row.id);
          if (!storage || storage.binLabels.length === 0) {
            return <span className="text-xs text-slate-400 italic">Unassigned</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1 max-w-40">
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
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setPrintModalProducts([row]);
              }}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
              title="Print Barcode Label"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditModal(row);
              }}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
              title="Edit Product"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteProductTarget(row);
              }}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
              title="Delete Product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    );

    return cols;
  }, [productStorageMap, selectedProductIds, filteredProducts, isSelectionMode]);

  const exportProductColumns: ExportColumn<Product>[] = [
    { header: 'Product Code', accessor: (p) => p.code || 'N/A' },
    { header: 'Barcode', accessor: (p) => p.barcode || p.code || 'N/A' },
    { header: 'Product Name', accessor: (p) => p.name || 'N/A' },
    { header: 'Category', accessor: (p) => p.family?.category?.name || 'N/A' },
    { header: 'Family', accessor: (p) => p.family?.name || 'N/A' },
    {
      header: 'Warehouse Location',
      accessor: (p) => {
        const storage = productStorageMap.get(p.id);
        if (!storage || storage.binLabels.length === 0) return 'Unassigned';
        return storage.binLabels.join(', ');
      },
    },
    { header: 'UOM', accessor: (p) => p.uom || 'N/A' },
    {
      header: 'MSL (Min Stock)',
      isNumeric: true,
      accessor: (p) =>
        p.minimumInventory && Number(p.minimumInventory) > 0
          ? `${p.minimumInventory} ${p.uom || ''}`
          : 'Not Monitored',
    },
    { header: 'Status', accessor: (p) => (p.isActive ? 'Active' : 'Inactive') },
  ];

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
                  Product Identification & Barcode
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Product Code */}
                  <FormField
                    label="Product Code"
                    id="product-code"
                    required
                    error={formErrors.code}
                    hint={
                      editingProduct
                        ? 'Unique identifier (e.g. RM-0001).'
                        : 'Auto-generated next sequence (e.g. RM-0451). Editable if custom code required.'
                    }
                  >
                    <div className="relative">
                      <TextInput
                        id="product-code"
                        value={code}
                        onChange={(e) => {
                          const upper = e.target.value.toUpperCase();
                          setCode(upper);
                          if (!editingProduct && (!barcode || barcode.startsWith('PRD-'))) {
                            setBarcode(upper ? (upper.startsWith('PRD-') ? upper : `PRD-${upper}`) : '');
                          }
                        }}
                        placeholder={editingProduct ? 'e.g. RM-0001' : 'Auto-generated (e.g. RM-0451)'}
                        error={!!formErrors.code}
                        className="font-mono uppercase font-semibold pr-9"
                        required
                      />
                      {!editingProduct && (
                        <button
                          type="button"
                          onClick={handleRegenerateCode}
                          title="Recalculate next product code"
                          className="absolute right-2 top-2 p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </FormField>

                  {/* Product Name */}
                  <FormField
                    label="Product Name"
                    id="product-name"
                    required
                    error={formErrors.name}
                    hint="Descriptive name of the material."
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

                  {/* Barcode (Code 128) */}
                  <FormField
                    label="Barcode (Code 128)"
                    id="product-barcode"
                    hint={
                      editingProduct
                        ? 'Unique barcode. Clear to auto-regenerate.'
                        : 'Auto-generated unique Code 128 barcode. Scannable via laser/camera.'
                    }
                  >
                    <div className="relative">
                      <TextInput
                        id="product-barcode"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value.trim().toUpperCase())}
                        placeholder={editingProduct ? 'PRD-XXXXXX' : 'Auto-generated barcode'}
                        className="font-mono uppercase pr-16"
                      />
                      <div className="absolute right-2 top-2 flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleRegenerateBarcode()}
                          title="Auto-generate / re-sync barcode from code"
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <BarcodeIcon className="w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </FormField>
                </div>

                {/* Live Barcode Preview Box */}
                {(barcode || (editingProduct && editingProduct.barcode) || code) && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white p-1 rounded border border-slate-200">
                        <BarcodeSvg
                          value={barcode || editingProduct?.barcode || (code ? (code.startsWith('PRD-') ? code : `PRD-${code}`) : 'PRD-ITEM')}
                          width={1.2}
                          height={28}
                          fontSize={9}
                          margin={1}
                        />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                          Code 128 Scannable Preview
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          {barcode || editingProduct?.barcode || (code ? (code.startsWith('PRD-') ? code : `PRD-${code}`) : 'PRD-ITEM')}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const targetProd: Product = {
                          ...(editingProduct || {
                            id: 'preview',
                            name: name || 'New Product',
                            code: code || 'CODE',
                            familyId: familyId || '',
                            minimumInventory: Number(msl) || 0,
                            isActive: true,
                            createdAt: '',
                            updatedAt: '',
                          }),
                          name: name || 'New Product',
                          code: code || 'CODE',
                          barcode: barcode || editingProduct?.barcode || (code ? (code.startsWith('PRD-') ? code : `PRD-${code}`) : 'PRD-ITEM'),
                          uom: uom,
                        };
                        setPrintModalProducts([targetProd]);
                      }}
                      className="cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      <span>Test Print Label</span>
                    </Button>
                  </div>
                )}
              </div>

              {/* Categorization Section */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Category & Classification
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Category <span className="text-red-500 font-bold">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateCategoryModal()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        title="Create a new Category in Master Data"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Category</span>
                      </button>
                    </div>

                    {isCustomCategory ? (
                      <div className="space-y-1.5">
                        <TextInput
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="New Category Name (e.g. Raw Material)"
                          error={!!formErrors.category}
                        />
                        <div className="flex items-center justify-between pt-0.5">
                          <button
                            type="button"
                            onClick={() => setIsCustomCategory(false)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                          >
                            ← Select existing category
                          </button>
                          <span className="text-[11px] text-slate-400">Will be created automatically on save</span>
                        </div>
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
                          onCreateOption={(term) => handleOpenCreateCategoryModal(term)}
                          createOptionLabel={(term) => term ? `Create Category "${term}"` : 'Add New Category'}
                        />
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsCustomCategory(true);
                              setIsCustomFamily(true);
                            }}
                            className="font-medium text-slate-500 hover:text-blue-600 hover:underline cursor-pointer"
                          >
                            Type custom category
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCreateCategoryModal()}
                            className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create Master Category</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {formErrors.category && <p className="text-xs font-medium text-red-600 mt-1">{formErrors.category}</p>}
                  </div>

                  {/* Product Family */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Product Family <span className="text-red-500 font-bold">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateFamilyModal()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                        title="Create a new Product Family in Master Data"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Family</span>
                      </button>
                    </div>

                    {isCustomFamily ? (
                      <div className="space-y-1.5">
                        <TextInput
                          value={customFamily}
                          onChange={(e) => setCustomFamily(e.target.value)}
                          placeholder="New Family Name (e.g. Alloy Steel)"
                          error={!!formErrors.family}
                        />
                        <div className="flex items-center justify-between pt-0.5">
                          {!isCustomCategory && (
                            <button
                              type="button"
                              onClick={() => setIsCustomFamily(false)}
                              className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                            >
                              ← Select existing family
                            </button>
                          )}
                          <span className="text-[11px] text-slate-400">Will be created automatically on save</span>
                        </div>
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
                          onCreateOption={(term) => handleOpenCreateFamilyModal(term)}
                          createOptionLabel={(term) => term ? `Create Family "${term}"` : 'Add New Product Family'}
                        />
                        <div className="flex items-center justify-between text-xs pt-0.5">
                          <button
                            type="button"
                            onClick={() => setIsCustomFamily(true)}
                            className="font-medium text-slate-500 hover:text-blue-600 hover:underline cursor-pointer"
                          >
                            Type custom family
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenCreateFamilyModal()}
                            className="font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Create Master Family</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {formErrors.family && <p className="text-xs font-medium text-red-600 mt-1">{formErrors.family}</p>}
                  </div>
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
            <ExportDropdown
              data={filteredProducts}
              columns={exportProductColumns}
              fileName="Products_Master"
              reportTitle="Products Master & MSL Catalog"
              reportSubtitle={`Showing ${filteredProducts.length} product definitions`}
              metadata={{
                'Total Products': filteredProducts.length,
                'Active Filters': activeFilterCount > 0 ? `${activeFilterCount} active` : 'None',
                Search: searchQuery || 'All',
              }}
            />
            <Button
              variant={isSelectionMode ? 'primary' : 'secondary'}
              onClick={() => {
                if (isSelectionMode) {
                  setIsSelectionMode(false);
                  setSelectedProductIds(new Set());
                } else {
                  setIsSelectionMode(true);
                }
              }}
              className={
                isSelectionMode
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  : 'cursor-pointer'
              }
              title={isSelectionMode ? 'Exit Selection Mode' : 'Select multiple products to delete or print barcodes'}
            >
              <CheckSquare className="w-4 h-4 mr-1.5" />
              <span>{isSelectionMode ? 'Cancel Selection' : 'Select'}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={handleBackfillAllBarcodes}
              disabled={isBackfilling || isLoading}
              className="cursor-pointer"
              title="Auto-generate and link unique Code 128 barcodes for all products"
            >
              <BarcodeIcon className={`w-4 h-4 mr-1.5 text-blue-600 ${isBackfilling ? 'animate-pulse' : ''}`} />
              <span>{isBackfilling ? 'Linking...' : 'Sync Barcodes'}</span>
            </Button>
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

      {/* Batch Action Toolbar when in Selection Mode */}
      {isSelectionMode && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl shadow-xs transition-all animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
              {selectedProductIds.size} Selected
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {selectedProductIds.size === 0
                ? 'Check the boxes or click any row to select products'
                : `${selectedProductIds.size} of ${filteredProducts.length} product(s) selected`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (
                  filteredProducts.length > 0 &&
                  selectedProductIds.size === filteredProducts.length
                ) {
                  setSelectedProductIds(new Set());
                } else {
                  setSelectedProductIds(new Set(filteredProducts.map((p) => p.id)));
                }
              }}
              className="text-xs h-8 px-2.5 bg-white hover:bg-slate-50 cursor-pointer"
            >
              {filteredProducts.length > 0 &&
              selectedProductIds.size === filteredProducts.length
                ? 'Deselect All'
                : 'Select All'}
            </Button>

            {/* Print Barcodes Button */}
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedProductIds.size === 0}
              onClick={() => {
                const toPrint = products.filter((p) => selectedProductIds.has(p.id));
                setPrintModalProducts(toPrint);
              }}
              className={`text-xs h-8 px-3 border-blue-200 text-blue-700 bg-white hover:bg-blue-50 cursor-pointer ${
                selectedProductIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Print Barcode Labels for selected products"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              <span>Print Barcodes ({selectedProductIds.size})</span>
            </Button>

            {/* Delete Selected Button */}
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedProductIds.size === 0}
              onClick={() => setIsBulkDeleteConfirmOpen(true)}
              className={`text-xs h-8 px-3 border-red-200 text-red-700 bg-white hover:bg-red-50 hover:border-red-300 cursor-pointer ${
                selectedProductIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Delete selected products"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5 text-red-600" />
              <span>Delete ({selectedProductIds.size})</span>
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedProductIds(new Set());
              }}
              className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 cursor-pointer ml-1"
              title="Exit Selection Mode"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredProducts}
          isLoading={isLoading}
          isError={!!error}
          errorMsg={error || undefined}
          onRetry={loadData}
          onRowClick={
            isSelectionMode
              ? (row) => {
                  const next = new Set(selectedProductIds);
                  if (next.has(row.id)) next.delete(row.id);
                  else next.add(row.id);
                  setSelectedProductIds(next);
                }
              : openEditModal
          }
          searchable={false}
          pagination={true}
          defaultPageSize={15}
        />
      </div>
    </>
  )}

    {/* Quick Create Category Modal */}
    <Modal
      isOpen={isCreateCategoryModalOpen}
      onClose={() => setIsCreateCategoryModalOpen(false)}
      title="Create New Category"
    >
      <form onSubmit={handleSubmitCreateCategory} className="space-y-4">
        <p className="text-xs text-slate-500">
          Create a new product category in master data. It will be immediately available and selected for this product.
        </p>

        {quickCategoryError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quickCategoryError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Category Name *
          </label>
          <TextInput
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g. Raw Material, Hardware & Fasteners, Consumables"
            autoFocus
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCreateCategoryModalOpen(false)}
            disabled={isCreatingCategory}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isCreatingCategory || !newCategoryName.trim()}
          >
            {isCreatingCategory ? 'Creating...' : 'Create Category'}
          </Button>
        </div>
      </form>
    </Modal>

    {/* Quick Create Product Family Modal */}
    <Modal
      isOpen={isCreateFamilyModalOpen}
      onClose={() => setIsCreateFamilyModalOpen(false)}
      title="Create New Product Family"
    >
      <form onSubmit={handleSubmitCreateFamily} className="space-y-4">
        <p className="text-xs text-slate-500">
          Create a new product family under the selected category. It will be immediately linked and selected.
        </p>

        {quickFamilyError && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quickFamilyError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Parent Category *
          </label>
          <Select
            value={newFamilyCategoryId || categoryId || ''}
            onChange={(e) => setNewFamilyCategoryId(e.target.value)}
            required
          >
            <option value="">Select Category...</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
            Product Family Name *
          </label>
          <TextInput
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            placeholder="e.g. Alloy Steel, Hex Bolts, Carbide Inserts"
            autoFocus
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsCreateFamilyModalOpen(false)}
            disabled={isCreatingFamily}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isCreatingFamily || !newFamilyName.trim() || !(newFamilyCategoryId || categoryId)}
          >
            {isCreatingFamily ? 'Creating...' : 'Create Product Family'}
          </Button>
        </div>
      </form>
    </Modal>

    {/* Confirm Product Deletion Dialog */}
    <ConfirmDialog
      isOpen={!!deleteProductTarget}
      onClose={() => setDeleteProductTarget(null)}
      onConfirm={handleDeleteProduct}
      title="Delete Product"
      message={
        <span>
          Are you sure you want to permanently delete product{' '}
          <strong className="text-gray-900">{deleteProductTarget?.name}</strong>{' '}
          ({deleteProductTarget?.code || 'No Code'})? This action cannot be undone.
        </span>
      }
      confirmText={isDeleting ? 'Deleting...' : 'Delete Product'}
      isDanger={true}
    />

    {/* Confirm Bulk Product Deletion Dialog */}
    <ConfirmDialog
      isOpen={isBulkDeleteConfirmOpen}
      onClose={() => !isBulkDeleting && setIsBulkDeleteConfirmOpen(false)}
      onConfirm={handleBulkDelete}
      title={`Delete ${selectedProductIds.size} Products`}
      message={
        <div className="space-y-3">
          <p>
            Are you sure you want to permanently delete{' '}
            <strong className="text-gray-900">{selectedProductIds.size}</strong> selected products?
          </p>
          <div className="max-h-36 overflow-y-auto rounded-md bg-slate-50 dark:bg-slate-800/50 p-2.5 text-xs text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 space-y-1">
            {Array.from(selectedProductIds).slice(0, 10).map((id) => {
              const p = products.find((prod) => prod.id === id);
              return (
                <div key={id} className="flex items-center justify-between py-0.5 border-b border-slate-100 last:border-b-0">
                  <span className="font-medium truncate">{p?.name || id}</span>
                  <span className="font-mono text-slate-500 ml-2">{p?.code || '—'}</span>
                </div>
              );
            })}
            {selectedProductIds.size > 10 && (
              <div className="text-slate-400 italic pt-1">
                ...and {selectedProductIds.size - 10} more
              </div>
            )}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Note: Products with historical stock transactions or active inventory cannot be deleted and will be automatically skipped.
          </p>
        </div>
      }
      confirmText={isBulkDeleting ? 'Deleting...' : `Delete ${selectedProductIds.size} Products`}
      isDanger={true}
    />

    {/* Barcode Thermal & Sheet Label Print Modal */}
    {printModalProducts && (
      <BarcodeLabelModal
        isOpen={!!printModalProducts}
        products={printModalProducts}
        productStorageMap={productStorageMap}
        onClose={() => setPrintModalProducts(null)}
      />
    )}
  </div>
);
}
