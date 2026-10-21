import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  PackageCheck,
  Search,
  RefreshCw,
  Building2,
  Layers,
  Sparkles,
  Printer,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { consumablesApi } from '../services/consumables.service';
import { VelanPrPrintModal } from '../components/consumables';
import { matchesPrNumber } from './ConsumablePurchaseStoreWorkspace';
import type {
  ConsumableItemDraft,
  ConsumableLineItemRecord,
  ProductCatalogItem,
  VendorOption,
  ConsumablePaymentMode,
} from '../types/consumables.types';
import toast from 'react-hot-toast';

export function ConsumableRequestsWorkspace() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'TRACKER'>('BUILDER');

  // Loading states
  const [submitting, setSubmitting] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Master lookup data
  const [catalog, setCatalog] = useState<ProductCatalogItem[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);

  // Form State (Sub-Module 1A)
  const [paymentMode, setPaymentMode] = useState<ConsumablePaymentMode>('CASH');
  const [endUserInVelan, setEndUserInVelan] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  // Draft items in the request builder
  const [draftItems, setDraftItems] = useState<ConsumableItemDraft[]>([
    {
      tempId: 'row-1',
      isNewProduct: false,
      productId: '',
      productCode: '',
      description: '',
      uom: 'NOS',
      requestedQty: 1,
      stockAvailableAtRequest: 0,
      isNewVendor: false,
    },
  ]);

  // Production Tracking & Receipt Queue (Sub-Module 1B)
  const [lineItems, setLineItems] = useState<ConsumableLineItemRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY_FOR_RECEIPT' | 'OPEN' | 'CLOSED'>('ALL');
  const [viewingPrItems, setViewingPrItems] = useState<ConsumableLineItemRecord[] | null>(null);

  // Initialize requester name from current user
  useEffect(() => {
    if (currentUser?.name && !requestedBy) {
      setRequestedBy(currentUser.name);
    }
  }, [currentUser]);

  // Fetch product catalog & vendors on mount
  useEffect(() => {
    loadLookups();
    loadLineItems();
  }, []);

  const loadLookups = async () => {
    try {
      const [catalogData, vendorData] = await Promise.all([
        consumablesApi.getCatalogWithStock(),
        consumablesApi.getVendors(),
      ]);
      setCatalog(catalogData || []);
      setVendors(vendorData || []);
    } catch (err) {
      console.error('Failed to load catalog or vendors', err);
    }
  };

  const loadLineItems = async () => {
    setLoadingItems(true);
    try {
      const items = await consumablesApi.getLineItems();
      setLineItems(items || []);
    } catch (err) {
      console.error('Failed to load consumable line items', err);
    } finally {
      setLoadingItems(false);
    }
  };

  // --- DRAFT ITEM HELPERS ---
  const handleAddRow = () => {
    const newRow: ConsumableItemDraft = {
      tempId: `row-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      isNewProduct: false,
      productId: '',
      productCode: '',
      description: '',
      uom: 'NOS',
      requestedQty: 1,
      stockAvailableAtRequest: 0,
      isNewVendor: false,
    };
    setDraftItems((prev) => [...prev, newRow]);
  };

  const handleRemoveRow = (tempId: string) => {
    if (draftItems.length === 1) {
      toast.error('At least one line item is required.');
      return;
    }
    setDraftItems((prev) => prev.filter((r) => r.tempId !== tempId));
  };

  const handleUpdateRow = (tempId: string, updates: Partial<ConsumableItemDraft>) => {
    setDraftItems((prev) =>
      prev.map((row) => {
        if (row.tempId !== tempId) return row;
        const merged = { ...row, ...updates };

        // If product was selected from catalog, update description, code, uom and live stock
        if (updates.productId !== undefined && !merged.isNewProduct) {
          const product = catalog.find((p) => p.id === updates.productId);
          if (product) {
            merged.description = product.name;
            merged.productCode = product.code || '';
            merged.uom = product.uom || 'NOS';
            merged.stockAvailableAtRequest = Number(product.availableStock || 0);
          }
        }

        // If switched to new product
        if (updates.isNewProduct === true) {
          merged.productId = undefined;
          merged.productCode = undefined;
          merged.stockAvailableAtRequest = 0;
        }

        return merged;
      })
    );
  };

  // --- SUBMIT REQUEST ---
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!endUserInVelan.trim()) {
      toast.error('Please specify End User in Velan (Machine, Bay, or Operator).');
      return;
    }
    if (!requestedBy.trim()) {
      toast.error('Please enter the Requester Name / ID.');
      return;
    }

    // Validate each row
    for (let i = 0; i < draftItems.length; i++) {
      const row = draftItems[i];
      if (row.isNewProduct) {
        if (!row.description.trim()) {
          toast.error(`Line #${i + 1}: Please enter the new product description.`);
          return;
        }
      } else {
        if (!row.productId) {
          toast.error(`Line #${i + 1}: Please select a catalog product or toggle "+ New Product".`);
          return;
        }
      }

      // If new vendor is checked, validate name
      if (row.isNewVendor && !row.newVendorName?.trim()) {
        toast.error(`Line #${i + 1}: Please enter the New Vendor Name.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        paymentMode,
        endUserInVelan: endUserInVelan.trim(),
        requestedBy: requestedBy.trim(),
        remarks: remarks.trim() || undefined,
        items: draftItems.map((item) => ({
          isNewProduct: Boolean(item.isNewProduct),
          productId: item.productId ? item.productId : undefined,
          productCode: item.productCode ? item.productCode : undefined,
          description: item.description.trim(),
          uom: item.uom.trim() || 'NOS',
          requestedQty: Number(item.requestedQty || 0),
          stockAvailableAtRequest: Number(item.stockAvailableAtRequest || 0),
          vendorId: item.vendorId || undefined,
          vendorName: item.vendorName || undefined,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
          isNewVendor: item.isNewVendor,
          newVendorName: item.newVendorName?.trim() || undefined,
          newVendorAddress: item.newVendorAddress?.trim() || undefined,
          newVendorMobile: item.newVendorMobile?.trim() || undefined,
          newVendorPrice: item.newVendorPrice ? Number(item.newVendorPrice) : undefined,
        })),
      };

      await consumablesApi.createRequest(payload);
      toast.success('Consumable request submitted successfully!');

      // Reset form
      setDraftItems([
        {
          tempId: `row-${Date.now()}`,
          isNewProduct: false,
          productId: '',
          productCode: '',
          description: '',
          uom: 'NOS',
          requestedQty: 1,
          stockAvailableAtRequest: 0,
          isNewVendor: false,
        },
      ]);
      setRemarks('');

      // Refresh tracking queue and switch to tracking tab
      await loadLineItems();
      setActiveTab('TRACKER');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit consumable request');
    } finally {
      setSubmitting(false);
    }
  };

  // --- CONFIRM RECEIPT (SUB-MODULE 1B) ---
  const handleConfirmReceive = async (item: ConsumableLineItemRecord) => {
    setActionInProgressId(item.id);
    try {
      await consumablesApi.confirmProductionReceive(item.id);
      toast.success(`Handover confirmed! Line item "${item.description}" received by Production.`);
      await loadLineItems();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to confirm receipt of item');
    } finally {
      setActionInProgressId(null);
    }
  };

  // --- FILTERED TRACKING LIST ---
  const filteredLineItems = useMemo(() => {
    return lineItems.filter((item) => {
      // Search filter
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.description.toLowerCase().includes(q) ||
        item.requestCode?.toLowerCase().includes(q) ||
        (item.prNumber && matchesPrNumber(item.prNumber, q)) ||
        (item.endUserInVelan && item.endUserInVelan.toLowerCase().includes(q)) ||
        (item.requestedBy && item.requestedBy.toLowerCase().includes(q)) ||
        (item.vendorName && item.vendorName.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status sub-filter
      if (statusFilter === 'READY_FOR_RECEIPT') {
        return item.status === 'ISSUED_TO_PRODUCTION';
      }
      if (statusFilter === 'OPEN') {
        return ['OPEN', 'PURCHASE_REQUESTED', 'PURCHASE_RECEIVED', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'].includes(item.status);
      }
      if (statusFilter === 'CLOSED') {
        return item.status === 'RECEIVED_BY_PRODUCTION';
      }
      return true;
    });
  }, [lineItems, searchQuery, statusFilter]);

  // Summary counts
  const readyForReceiptCount = useMemo(
    () => lineItems.filter((i) => i.status === 'ISSUED_TO_PRODUCTION').length,
    [lineItems]
  );
  const inStockTrackCount = useMemo(
    () => lineItems.filter((i) => i.itemCategoryTrack === 'STOCK_ITEM').length,
    [lineItems]
  );
  const nonStockTrackCount = useMemo(
    () => lineItems.filter((i) => i.itemCategoryTrack === 'NON_STOCK_OR_NEW').length,
    [lineItems]
  );
  const closedCount = useMemo(
    () => lineItems.filter((i) => i.status === 'RECEIVED_BY_PRODUCTION').length,
    [lineItems]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Consumable Request & Production Receipt"
        subtitle="Module 1: Create multi-line requests with instant auto-master creation and confirm shop-floor physical receipt"
        actionSlot={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'BUILDER' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('BUILDER')}
              className="flex items-center gap-1.5"
            >
              <ShoppingCart className="w-4 h-4" />
              Raise Request
            </Button>
            <Button
              variant={activeTab === 'TRACKER' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('TRACKER')}
              className="flex items-center gap-1.5 relative"
            >
              <PackageCheck className="w-4 h-4" />
              Receipt Queue
              {readyForReceiptCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[11px] font-bold rounded-full bg-emerald-500 text-white animate-pulse">
                  {readyForReceiptCount}
                </span>
              )}
            </Button>
          </div>
        }
      />

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Total Items</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{lineItems.length}</p>
          <span className="text-[11px] text-slate-400">All requested consumables</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">In-Stock Track</span>
            <CheckCircle2 className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{inStockTrackCount}</p>
          <span className="text-[11px] text-slate-400">Stock available at request</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Purchase Track</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{nonStockTrackCount}</p>
          <span className="text-[11px] text-slate-400">Out-of-stock / New items</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ready to Receive</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{readyForReceiptCount}</p>
          <span className="text-[11px] text-slate-400">Awaiting shop-floor acknowledgment</span>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* SUB-MODULE 1A: MULTI-LINE CONSUMABLE REQUEST BUILDER        */}
      {/* ============================================================ */}
      {activeTab === 'BUILDER' && (
        <form onSubmit={handleSubmitRequest} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center font-bold">
                1
              </span>
              Header Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Payment Mode *
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CASH')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      paymentMode === 'CASH'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Cash Purchase
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('CREDIT')}
                    className={`py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      paymentMode === 'CREDIT'
                        ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    Credit / PO
                  </button>
                </div>
              </div>

              {/* End User in Velan */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  End User in Velan (Machine / Bay / Operator) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CNC Lathe 04 / Bay 2 / Operator Murugan"
                  value={endUserInVelan}
                  onChange={(e) => setEndUserInVelan(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Requested By */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                  Requested By (Name / ID) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rajesh Kumar (EMP-104)"
                  value={requestedBy}
                  onChange={(e) => setRequestedBy(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Optional Remarks */}
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1.5">
                Purpose / Remarks (Optional)
              </label>
              <input
                type="text"
                placeholder="Reason or job reference for this consumable request..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </Card>

          {/* Line Items Builder Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-indigo-600/15 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Consumable Line Items
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add items from catalog or create new products on-the-fly. Line items route into In-Stock vs. Purchase queues automatically.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleAddRow}
                className="flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-indigo-500" />
                Add Line Item
              </Button>
            </div>

            <div className="space-y-4">
              {draftItems.map((row, idx) => {
                const isOutOfStock =
                  row.isNewProduct || Number(row.stockAvailableAtRequest) === 0 || Number(row.stockAvailableAtRequest) < Number(row.requestedQty);

                return (
                  <div
                    key={row.tempId}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 relative group"
                  >
                    {/* Row Header & Delete */}
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                          #{idx + 1}
                        </span>

                        {/* Product Mode Toggle */}
                        <div className="inline-flex rounded-md p-0.5 bg-slate-200 dark:bg-slate-800 text-[11px] font-medium">
                          <button
                            type="button"
                            onClick={() => handleUpdateRow(row.tempId, { isNewProduct: false })}
                            className={`px-2.5 py-1 rounded-sm cursor-pointer transition-all ${
                              !row.isNewProduct
                                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Existing Catalog Product
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateRow(row.tempId, { isNewProduct: true })}
                            className={`px-2.5 py-1 rounded-sm cursor-pointer transition-all flex items-center gap-1 ${
                              row.isNewProduct
                                ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Sparkles className="w-3 h-3" />
                            + New Product (Auto-Create)
                          </button>
                        </div>
                      </div>

                      {/* Stock Route Badge */}
                      <div className="flex items-center gap-3">
                        {!isOutOfStock ? (
                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Track A: In-Stock (Ready for Issue)
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Track B: Non-Stock (Purchase Queue)
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.tempId)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Primary Product Inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                      {/* Product Selector / Name Input */}
                      <div className="md:col-span-6">
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          {row.isNewProduct ? 'New Product Name / Description *' : 'Select Catalog Product *'}
                        </label>
                        {row.isNewProduct ? (
                          <>
                            <input
                              type="text"
                              required
                              placeholder="e.g. HELLO, WD-40 400ml Spray, Sandvik Carbide Insert..."
                              value={row.description}
                              onChange={(e) => handleUpdateRow(row.tempId, { description: e.target.value })}
                              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                            />
                            {row.description.trim() && (
                              <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                <span>Code: <strong className="text-slate-800 dark:text-slate-200">{row.description.trim()}</strong></span>
                                <span>•</span>
                                <span>Barcode: <strong className="text-indigo-600 dark:text-indigo-400">PRD-{row.description.trim()}</strong></span>
                              </div>
                            )}
                          </>
                        ) : (
                          <select
                            required
                            value={row.productId || ''}
                            onChange={(e) => handleUpdateRow(row.tempId, { productId: e.target.value })}
                            className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                          >
                            <option value="">-- Choose consumable product --</option>
                            {catalog.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name} ({cat.code || 'NO-CODE'}) — Avail: {cat.availableStock} {cat.uom || 'NOS'}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* UOM */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          UOM
                        </label>
                        <input
                          type="text"
                          value={row.uom}
                          onChange={(e) => handleUpdateRow(row.tempId, { uom: e.target.value.toUpperCase() })}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                          placeholder="NOS"
                        />
                      </div>

                      {/* Live Stock Available Badge */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Current Stock
                        </label>
                        <div className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-800/50 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {row.stockAvailableAtRequest} {row.uom}
                        </div>
                      </div>

                      {/* Requested Qty */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-400 mb-1">
                          Requested Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.requestedQty}
                          onChange={(e) => handleUpdateRow(row.tempId, { requestedQty: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-semibold"
                          placeholder="0 for inquiry"
                        />
                      </div>
                    </div>

                    {/* Expandable Vendor Context for Non-Stock or New Products */}
                    {isOutOfStock && (
                      <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" />
                            Procurement / Vendor Details (Item requires Purchase Requisition)
                          </span>

                          <div className="inline-flex rounded-md p-0.5 bg-amber-200/60 dark:bg-amber-900/40 text-[10px] font-medium">
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.tempId, { isNewVendor: false })}
                              className={`px-2 py-0.5 rounded-xs cursor-pointer ${
                                !row.isNewVendor
                                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold'
                                  : 'text-amber-900 dark:text-amber-300'
                              }`}
                            >
                              Existing Vendor
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateRow(row.tempId, { isNewVendor: true })}
                              className={`px-2 py-0.5 rounded-xs cursor-pointer ${
                                row.isNewVendor
                                  ? 'bg-amber-600 text-white font-semibold'
                                  : 'text-amber-900 dark:text-amber-300'
                              }`}
                            >
                              + New Vendor
                            </button>
                          </div>
                        </div>

                        {!row.isNewVendor ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Preferred Vendor
                              </label>
                              <select
                                value={row.vendorId || ''}
                                onChange={(e) => {
                                  const selectedV = vendors.find((v) => v.id === e.target.value);
                                  handleUpdateRow(row.tempId, {
                                    vendorId: e.target.value,
                                    vendorName: selectedV?.name,
                                  });
                                }}
                                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              >
                                <option value="">-- Optional: select supplier --</option>
                                {vendors.map((v) => (
                                  <option key={v.id} value={v.id}>
                                    {v.name} ({v.phone || 'No phone'})
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                                Estimated Unit Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={row.unitPrice || ''}
                                onChange={(e) => handleUpdateRow(row.tempId, { unitPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full px-3 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-400 mb-0.5">
                                (a) Vendor Name *
                              </label>
                              <input
                                type="text"
                                placeholder="Supplier business name"
                                value={row.newVendorName || ''}
                                onChange={(e) => handleUpdateRow(row.tempId, { newVendorName: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-400 mb-0.5">
                                (b) Address
                              </label>
                              <input
                                type="text"
                                placeholder="City / Area"
                                value={row.newVendorAddress || ''}
                                onChange={(e) => handleUpdateRow(row.tempId, { newVendorAddress: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-400 mb-0.5">
                                (c) Mobile No.
                              </label>
                              <input
                                type="text"
                                placeholder="Phone / Mobile"
                                value={row.newVendorMobile || ''}
                                onChange={(e) => handleUpdateRow(row.tempId, { newVendorMobile: e.target.value })}
                                className="w-full px-2.5 py-1 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold uppercase text-amber-800 dark:text-amber-400 mb-0.5">
                                (d) Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Quoted price"
                                value={row.newVendorPrice || ''}
                                onChange={(e) => handleUpdateRow(row.tempId, { newVendorPrice: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2.5 py-1 text-xs rounded-md border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit Action Bar */}
            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                <span>Total Items: <b className="text-slate-900 dark:text-white">{draftItems.length}</b></span>
                <span>
                  In-Stock Route:{' '}
                  <b className="text-emerald-600 dark:text-emerald-400">
                    {draftItems.filter((i) => !i.isNewProduct && Number(i.stockAvailableAtRequest) >= Number(i.requestedQty)).length}
                  </b>
                </span>
                <span>
                  Purchase Route:{' '}
                  <b className="text-amber-600 dark:text-amber-400">
                    {draftItems.filter((i) => i.isNewProduct || Number(i.stockAvailableAtRequest) < Number(i.requestedQty)).length}
                  </b>
                </span>
              </div>

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold shadow-md cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Submit Consumable Request
                  </>
                )}
              </Button>
            </div>
          </Card>
        </form>
      )}

      {/* ============================================================ */}
      {/* SUB-MODULE 1B: PRODUCTION TRACKING & RECEIPT QUEUE          */}
      {/* ============================================================ */}
      {activeTab === 'TRACKER' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-500" />
                Production Consumable Tracking & Handover Receipt
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Track each line item through stores fulfillment. Confirm receipt on the shop floor when materials are handed over.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadLineItems}
                disabled={loadingItems}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingItems ? 'animate-spin' : ''}`} />
                Refresh Queue
              </Button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search description, request code, bay..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Items ({lineItems.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('READY_FOR_RECEIPT')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'READY_FOR_RECEIPT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200'
                }`}
              >
                Ready to Receive ({readyForReceiptCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('OPEN')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'OPEN'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CLOSED')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  statusFilter === 'CLOSED'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Closed ({closedCount})
              </button>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">Request #</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3">End User / Bay</th>
                  <th className="py-3 px-3">Track</th>
                  <th className="py-3 px-3 font-mono text-right">Req. Qty</th>
                  <th className="py-3 px-3 font-mono text-right">Issued Qty</th>
                  <th className="py-3 px-3">Current Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loadingItems ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading consumable line items...
                    </td>
                  </tr>
                ) : filteredLineItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No consumable line items match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredLineItems.map((item) => {
                    const isIssued = item.status === 'ISSUED_TO_PRODUCTION';
                    const isReceived = item.status === 'RECEIVED_BY_PRODUCTION';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          isIssued
                            ? 'bg-emerald-50/40 dark:bg-emerald-950/15'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Request Code */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.requestCode || 'CR-NEW'}
                          {item.prNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                setViewingPrItems([item]);
                              }}
                              className="mt-1 flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 px-1.5 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                              title="Click to view & print official Velan Purchase Requisition slip"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              PR. No. {item.prNumber}
                            </button>
                          )}
                        </td>

                        {/* Description */}
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {item.description}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {item.uom} {item.isNewProduct ? '• (New Product)' : ''}
                          </span>
                        </td>

                        {/* End User */}
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {item.endUserInVelan || '—'}
                          <span className="block text-[10px] text-slate-400">
                            By: {item.requestedBy || 'Production'}
                          </span>
                        </td>

                        {/* Track */}
                        <td className="py-3 px-3">
                          {item.itemCategoryTrack === 'STOCK_ITEM' ? (
                            <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300">
                              STOCK
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-xs text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                              PURCHASE
                            </span>
                          )}
                        </td>

                        {/* Requested Qty */}
                        <td className="py-3 px-3 font-mono text-right font-semibold text-slate-700 dark:text-slate-300">
                          {Number(item.requestedQty || 0)} {item.uom}
                        </td>

                        {/* Issued Qty */}
                        <td className="py-3 px-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                          {Number(item.issuedQty || 0)} {item.uom}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3">
                          {item.status === 'RECEIVED_BY_PRODUCTION' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1 w-fit">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Received & Closed
                            </span>
                          ) : item.status === 'ISSUED_TO_PRODUCTION' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white animate-pulse shadow-xs">
                              Issued by Store — Ready for Handover
                            </span>
                          ) : item.status === 'PARTIALLY_ISSUED' || (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0)) ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white shadow-xs">
                              Open (Partial: {item.issuedQty} / {item.requestedQty} {item.uom})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-500/20">
                              Open
                            </span>
                          )}
                        </td>

                        {/* Action Column */}
                        <td className="py-3 px-3 text-center">
                          {isIssued ? (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={actionInProgressId === item.id}
                              onClick={() => handleConfirmReceive(item)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs mx-auto cursor-pointer"
                            >
                              {actionInProgressId === item.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Confirm Received
                            </Button>
                          ) : item.status === 'PARTIALLY_ISSUED' ? (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Partial Delivery ({item.issuedQty}/{item.requestedQty})
                            </span>
                          ) : isReceived ? (
                            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Handover Verified
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              Stores in progress
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Velan Metrology Purchase Requisition Slip Print Modal */}
      {viewingPrItems && viewingPrItems.length > 0 && (
        <VelanPrPrintModal
          isOpen={!!viewingPrItems}
          onClose={() => setViewingPrItems(null)}
          prNumber={viewingPrItems[0].prNumber || '1'}
          date={viewingPrItems[0].printedAt ? String(viewingPrItems[0].printedAt) : new Date().toISOString()}
          paymentMode="CASH"
          items={viewingPrItems}
          preparedBy={viewingPrItems[0].requestedBy}
        />
      )}
    </div>
  );
}

export default ConsumableRequestsWorkspace;
