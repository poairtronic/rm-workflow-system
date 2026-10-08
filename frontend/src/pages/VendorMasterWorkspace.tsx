import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { vendorMasterApi } from '../services/vendorMaster.service';
import type {
  VendorMasterDto,
  CreateVendorMasterDto,
  UpdateVendorMasterDto,
} from '../types/vendor-master.dto';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  ConfirmDialog,
  FormField,
  TextInput,
  Textarea,
  Checkbox,
  Button,
} from '../components/ui';
import type { ColumnDef } from '../components/ui';
import { Plus, Edit2, CheckCircle2, XCircle, Building2, Phone, Mail, User, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export function VendorMasterWorkspace() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const canWrite =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'GENERAL_MANAGER';

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorMasterDto | null>(null);

  // Form State
  const [formData, setFormData] = useState<CreateVendorMasterDto>({
    code: '',
    name: '',
    category: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    isActive: true,
  });

  // Toggle Confirm Dialog
  const [toggleVendor, setToggleVendor] = useState<VendorMasterDto | null>(null);

  // Fetch Vendors
  const {
    data: vendors = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['vendors-master'],
    queryFn: () => vendorMasterApi.getAll(),
  });

  // Unique Categories for Filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    vendors.forEach((v) => {
      if (v.category?.trim()) set.add(v.category.trim());
    });
    return Array.from(set).sort();
  }, [vendors]);

  // Filtered Vendors
  const filteredVendors = useMemo(() => {
    const list = vendors.filter((v) => {
      if (selectedCategory !== 'ALL' && v.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus === 'ACTIVE' && !v.isActive) return false;
      if (selectedStatus === 'INACTIVE' && v.isActive) return false;
      return true;
    });

    return list.sort((a, b) => {
      const numA = parseInt(a.code.replace(/\D/g, ''), 10);
      const numB = parseInt(b.code.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.code.localeCompare(b.code);
    });
  }, [vendors, selectedCategory, selectedStatus]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (dto: CreateVendorMasterDto) => vendorMasterApi.create(dto),
    onSuccess: () => {
      toast.success('Vendor registered successfully');
      queryClient.invalidateQueries({ queryKey: ['vendors-master'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create vendor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateVendorMasterDto }) =>
      vendorMasterApi.update(id, dto),
    onSuccess: () => {
      toast.success('Vendor updated successfully');
      queryClient.invalidateQueries({ queryKey: ['vendors-master'] });
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to update vendor');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => vendorMasterApi.toggleActive(id),
    onSuccess: (updated) => {
      toast.success(
        `Vendor ${updated.name} is now ${updated.isActive ? 'Active' : 'Inactive'}`,
      );
      queryClient.invalidateQueries({ queryKey: ['vendors-master'] });
      setToggleVendor(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to toggle vendor status');
      setToggleVendor(null);
    },
  });

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      code: '',
      name: '',
      category: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      notes: '',
      isActive: true,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor: VendorMasterDto) => {
    setEditingVendor(vendor);
    setFormData({
      code: vendor.code,
      name: vendor.name,
      category: vendor.category || '',
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
      isActive: vendor.isActive,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Vendor Code and Name are required');
      return;
    }

    if (editingVendor) {
      updateMutation.mutate({
        id: editingVendor.id,
        dto: {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          category: formData.category?.trim() || undefined,
          contactPerson: formData.contactPerson?.trim() || undefined,
          email: formData.email?.trim() || undefined,
          phone: formData.phone?.trim() || undefined,
          address: formData.address?.trim() || undefined,
          notes: formData.notes?.trim() || undefined,
          isActive: formData.isActive,
        },
      });
    } else {
      createMutation.mutate({
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        category: formData.category?.trim() || undefined,
        contactPerson: formData.contactPerson?.trim() || undefined,
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
        isActive: formData.isActive,
      });
    }
  };

  const columns: ColumnDef<VendorMasterDto>[] = [
    {
      key: 'code',
      header: 'Vendor Code',
      sortable: true,
      render: (v) => (
        <span className="font-mono font-medium text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {v.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Vendor Name',
      sortable: true,
      render: (v) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{v.name}</span>
          {v.address && (
            <span className="text-xs text-gray-500 truncate max-w-xs" title={v.address}>
              {v.address}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (v) => (
        <span className="text-sm text-gray-700">
          {v.category || <span className="text-gray-400 italic">Uncategorized</span>}
        </span>
      ),
    },
    {
      key: 'contactPerson',
      header: 'Contact Details',
      render: (v) => (
        <div className="text-xs space-y-0.5">
          {v.contactPerson && (
            <div className="flex items-center text-gray-800">
              <User className="w-3 h-3 mr-1 text-gray-400" />
              <span>{v.contactPerson}</span>
            </div>
          )}
          {v.email && (
            <div className="flex items-center text-gray-600">
              <Mail className="w-3 h-3 mr-1 text-gray-400" />
              <a href={`mailto:${v.email}`} className="hover:underline">
                {v.email}
              </a>
            </div>
          )}
          {v.phone && (
            <div className="flex items-center text-gray-600">
              <Phone className="w-3 h-3 mr-1 text-gray-400" />
              <span>{v.phone}</span>
            </div>
          )}
          {!v.contactPerson && !v.email && !v.phone && (
            <span className="text-gray-400 italic">No contact info</span>
          )}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      render: (v) => (
        <StatusBadge status={v.isActive ? 'ACTIVE' : 'INACTIVE'} />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (v) => (
        <div className="flex items-center space-x-2">
          {canWrite ? (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(v);
                }}
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit Vendor"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setToggleVendor(v);
                }}
                className={`p-1.5 rounded transition-colors ${
                  v.isActive
                    ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                    : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={v.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
              >
                {v.isActive ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {isModalOpen ? (
        <div className="max-w-3xl mx-auto w-full pb-12">
          <div className="mb-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Vendors List</span>
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {editingVendor ? 'Edit Vendor' : 'New Vendor'}
            </span>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">
                {editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Register New Vendor'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage vendor registration and procurement profile.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Vendor Code" required id="code" hint="Unique identifier (e.g. VND-010)">
              <TextInput
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="VND-XXX"
                required
              />
            </FormField>

            <FormField label="Vendor Name" required id="name">
              <TextInput
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Apex Heat Treatment Ltd."
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Category" id="category">
              <TextInput
                id="category"
                value={formData.category || ''}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Machining, Heat Treatment, Plating..."
              />
            </FormField>

            <FormField label="Contact Person" id="contactPerson">
              <TextInput
                id="contactPerson"
                value={formData.contactPerson || ''}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="Primary Contact Full Name"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Email" id="email">
              <TextInput
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@vendor.com"
              />
            </FormField>

            <FormField label="Phone" id="phone">
              <TextInput
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
              />
            </FormField>
          </div>

          <FormField label="Address" id="address">
            <Textarea
              id="address"
              rows={2}
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Factory or facility physical address..."
            />
          </FormField>

          <FormField label="Internal Notes / Capabilities" id="notes">
            <Textarea
              id="notes"
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Certifications, ISO ratings, machine specs..."
            />
          </FormField>

          <div className="pt-2">
            <Checkbox
              id="isActive"
              label="Active Status"
              description="Allow this vendor to be selected on Delivery Challans and purchase orders"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
          </div>

          <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsModalOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : editingVendor
                ? 'Update Vendor'
                : 'Create Vendor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  ) : (
    <>
      <PageHeader
        title="Vendors Master"
        subtitle="Manage approved external vendors, process capabilities, contact profiles, and active statuses."
        actionSlot={
          canWrite && (
            <Button
              onClick={handleOpenCreate}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4" />
              <span>New Vendor</span>
            </Button>
          )
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-gray-600">Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories ({vendors.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <label className="text-xs font-medium text-gray-600">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs border border-gray-300 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-gray-500 flex items-center space-x-1">
          <Building2 className="w-3.5 h-3.5 text-gray-400" />
          <span>
            Showing {filteredVendors.length} of {vendors.length} vendors
          </span>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={filteredVendors}
        isLoading={isLoading}
        isError={isError}
        errorMsg={(error as any)?.message || 'Failed to load vendors'}
        onRetry={refetch}
        searchable={true}
        searchKeys={['code', 'name', 'category', 'contactPerson', 'email']}
        pagination={true}
        defaultPageSize={10}
      />
    </>
  )}

      {/* Confirm Status Toggle Dialog */}
      <ConfirmDialog
        isOpen={!!toggleVendor}
        onClose={() => setToggleVendor(null)}
        onConfirm={() => {
          if (toggleVendor) {
            toggleMutation.mutate(toggleVendor.id);
          }
        }}
        title={toggleVendor?.isActive ? 'Deactivate Vendor' : 'Activate Vendor'}
        message={
          toggleVendor?.isActive ? (
            <span>
              Are you sure you want to deactivate{' '}
              <strong className="text-gray-900">{toggleVendor?.name}</strong>? It
              will no longer appear in new Delivery Challan creation forms.
            </span>
          ) : (
            <span>
              Activate <strong className="text-gray-900">{toggleVendor?.name}</strong>?
              This will re-enable selection on delivery forms.
            </span>
          )
        }
        confirmText={toggleVendor?.isActive ? 'Deactivate' : 'Activate'}
        isDanger={toggleVendor?.isActive}
      />
    </div>
  );
}
