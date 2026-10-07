import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PageHeader,
  DataTable,
  Button,
  Modal,
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
} from '../services/masterDataService';
import { Plus, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

const UOM_OPTIONS = ['KG', 'NOS', 'SQM', 'MTR', 'LTR'] as const;

export function ProductsMasterWorkspace() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      const [prodRes, catRes, famRes] = await Promise.all([
        masterDataService.getProducts({ pageSize: 100 }),
        masterDataService.getCategories({ pageSize: 100 }),
        masterDataService.getFamilies({ pageSize: 100 }),
      ]);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setFamilies(famRes.data || []);
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
    [],
  );

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Products Master & MSL"
        subtitle="Manage product definitions, specifications, UOMs, and Minimum Stock Levels (MSL)."
        breadcrumbs={<span>Masters / Products</span>}
        actionSlot={
          <div className="flex items-center space-x-3">
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
        }
      />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <DataTable
          columns={columns}
          data={products}
          isLoading={isLoading}
          isError={!!error}
          errorMsg={error || undefined}
          onRetry={loadData}
          onRowClick={openEditModal}
          searchable={true}
          searchKeys={['name', 'code']}
          pagination={true}
          defaultPageSize={15}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex items-center space-x-2">
            <Database className="w-5 h-5 text-primary" />
            <span className="font-semibold text-gray-900">
              {editingProduct ? 'Edit Product & MSL' : 'Create New Product'}
            </span>
          </div>
        }
      >
        <form onSubmit={handleSave} className="space-y-4 p-6 pt-4">
          {formErrors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Product Code */}
          <FormField
            label="Product Code"
            id="product-code"
            required
            error={formErrors.code}
            hint="Unique identifier (automatically converted to UPPERCASE)."
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
            hint="Full descriptive product name."
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
              <div className="space-y-1">
                <TextInput
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="New Category Name (e.g. Raw Material)"
                  error={!!formErrors.category}
                />
                <button
                  type="button"
                  onClick={() => setIsCustomCategory(false)}
                  className="text-xs text-primary hover:underline"
                >
                  ← Select existing category
                </button>
              </div>
            ) : (
              <div className="space-y-1">
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
                  className="text-xs text-primary hover:underline"
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
              <div className="space-y-1">
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
                    className="text-xs text-primary hover:underline"
                  >
                    ← Select existing family
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
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
                  className="text-xs text-primary hover:underline"
                >
                  + Type new family
                </button>
              </div>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
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
              hint="0 or empty = not monitored for alerts"
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

          {/* Active status */}
          <div className="pt-2">
            <Checkbox
              id="product-is-active"
              label="Active Product"
              description="Inactive products cannot be selected in new RM requests or Delivery Challans."
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
          </div>

          {/* Modal Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end space-x-3">
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
      </Modal>
    </div>
  );
}
