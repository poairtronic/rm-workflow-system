import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Send,
  Info,
  Search,
  Plus,
  Trash2,
  Lock,
  Loader2,
  X,
  Boxes,
  Calendar,
  CheckCircle2,
  Printer,
  ArrowRight,
} from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type {
  MercPoItemsResponse,
  SplDcItem,
  CreateSplDcPayload,
  AvailableStockProduct,
} from '../../types/delivery-challan.dto';

export function DcTypeSpl() {
  const navigate = useNavigate();

  // Vendor authorization state
  const [vendorId, setVendorId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('HT AND RETURN');

  // PO selection state
  const [poNumber, setPoNumber] = useState('');
  const [loadingPo, setLoadingPo] = useState(false);
  const [poData, setPoData] = useState<MercPoItemsResponse | null>(null);
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const poDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch available MERC POs for autocomplete suggestions
  const { data: mercPosList = [] } = useQuery({
    queryKey: ['merc-pos-list'],
    queryFn: () => deliveryChallanApi.getMercPos(),
    staleTime: 30000,
  });

  // Click outside listener for PO dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (poDropdownRef.current && !poDropdownRef.current.contains(event.target as Node)) {
        setShowPoDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available POs matching input
  const matchingPos = useMemo(() => {
    const q = poNumber.trim().toLowerCase();
    if (!q) {
      return (mercPosList as any[]).slice(0, 8);
    }
    return (mercPosList as any[]).filter((p: any) => {
      const matchPo = p.actualPoNumber && p.actualPoNumber.toLowerCase().includes(q);
      const matchDisplay = p.poNumber && p.poNumber.toLowerCase().includes(q);
      const matchLayout = p.layoutNumber && p.layoutNumber.toLowerCase().includes(q);
      const matchIndent = p.indentNumber && p.indentNumber.toLowerCase().includes(q);
      const matchCustomer = p.customerName && p.customerName.toLowerCase().includes(q);
      return matchPo || matchDisplay || matchLayout || matchIndent || matchCustomer;
    }).slice(0, 10);
  }, [mercPosList, poNumber]);

  // Dispatch group & items state
  const [processName, setProcessName] = useState('');
  const [targetProcess, setTargetProcess] = useState('');
  const [items, setItems] = useState<SplDcItem[]>([]);

  // Extra items stock picker modal state
  const [showStockPicker, setShowStockPicker] = useState(false);
  const [stockSearch, setStockSearch] = useState('');

  // Submit pending state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Post-generation state for printing and confirmation
  const [generatedDc, setGeneratedDc] = useState<{ id: string; dcNumber: string } | null>(null);

  // Reset form to create another SPL DC
  const handleResetForm = () => {
    setGeneratedDc(null);
    setPoNumber('');
    setPoData(null);
    setItems([]);
    setProcessName('');
    setTargetProcess('');
    setRemarks('HT AND RETURN');
    setVendorId('');
    setExpectedReturnDate('');
  };

  // Queries for Vendors, Processes, and SLAs
  const { data: vendorList } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors?isActive=true')),
  });

  const sortedVendorList = useMemo(() => {
    if (!vendorList) return [];
    return (vendorList as any[])
      .slice()
      .sort((a, b) => {
        const numA = parseInt((a.code || '').replace(/\D/g, ''), 10);
        const numB = parseInt((b.code || '').replace(/\D/g, ''), 10);
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [vendorList]);

  const { data: processList } = useQuery({
    queryKey: ['production-processes'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/production-processes')),
  });

  const { data: slaList } = useQuery({
    queryKey: ['vendor-slas'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors/slas')),
  });

  // Auto-calculate SLA return date when vendor or targetProcess changes
  useEffect(() => {
    if (vendorId) {
      if (targetProcess && slaList && slaList.length > 0) {
        const sla = slaList.find((s: any) => s.vendorId === vendorId && s.processId === targetProcess);
        if (sla?.slaDays) {
          const date = new Date();
          date.setDate(date.getDate() + Number(sla.slaDays));
          setExpectedReturnDate(date.toISOString().split('T')[0]);
          return;
        }
      }
      // If expectedReturnDate is not set yet, set default 7 days SLA
      if (!expectedReturnDate) {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        setExpectedReturnDate(date.toISOString().split('T')[0]);
      }
    }
  }, [vendorId, targetProcess, slaList]);

  // Fetch MERC PO Items
  const handleFetchPoItems = async (explicitPo?: string) => {
    const targetPo = (explicitPo !== undefined ? explicitPo : poNumber).trim();
    if (!targetPo) {
      toast.error('Please enter a PO Number or Layout Number');
      return;
    }

    setLoadingPo(true);
    setShowPoDropdown(false);
    try {
      const data = await deliveryChallanApi.getMercPoItems(targetPo);
      setPoData(data);

      // If user typed partial e.g. 1340, update input to the resolved full PO number
      if (data.poNumber && data.poNumber !== targetPo) {
        setPoNumber(data.poNumber);
      }

      // Auto-populate items from MERC line items
      const initialItems: SplDcItem[] = (data.lineItems || []).map((line) => ({
        poPartLabel: line.poPartLabel || `${data.poNumber} - ${line.name}`,
        mercItemId: line.mercItemId,
        partNo: line.name || '',
        dispatchedQty: line.quantityRequired > 0 ? Number(line.quantityRequired) : 1,
        batchNo: '',
        description: [line.material, line.shape].filter(Boolean).join(' ') || '',
        isExtraItem: false,
        itemType: line.itemType,
      }));

      setItems(initialItems);
      toast.success(`Loaded ${initialItems.length} line item(s) from MERC PO ${data.poNumber}`);
    } catch (err: any) {
      setPoData(null);
      setItems([]);
      const msg = err.response?.data?.message || err.message || 'PO not found in MERC indents';
      toast.error(msg);
    } finally {
      setLoadingPo(false);
    }
  };

  const handleSelectPo = (item: any) => {
    const selectedPo = item.actualPoNumber || item.poNumber || item.layoutNumber;
    setPoNumber(selectedPo);
    setShowPoDropdown(false);
    handleFetchPoItems(selectedPo);
  };

  // Update item field
  const updateItem = (index: number, field: keyof SplDcItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add extra item from stock
  const addExtraItem = (product: AvailableStockProduct) => {
    const extraItem: SplDcItem = {
      poPartLabel: `${poNumber.trim()} - ${product.productName}`,
      partNo: '', // user enters manually
      dispatchedQty: 1,
      isExtraItem: true,
      productId: product.productId,
      mercItemId: undefined,
    };
    setItems((prev) => [...prev, extraItem]);
    setShowStockPicker(false);
    setStockSearch('');
    toast.success(`Added ${product.productName} as extra item`);
  };

  // Filter available stock products for picker modal
  const filteredStockProducts = useMemo(() => {
    if (!poData?.availableStockProducts) return [];
    const term = stockSearch.toLowerCase().trim();
    if (!term) return poData.availableStockProducts;
    return poData.availableStockProducts.filter((p) =>
      p.productName.toLowerCase().includes(term) ||
      p.productId.toLowerCase().includes(term)
    );
  }, [poData?.availableStockProducts, stockSearch]);

  // Form validity check
  const isFormValid = useMemo(() => {
    if (!vendorId) return false;
    if (!poNumber.trim()) return false;
    if (!expectedReturnDate) return false;
    if (!items.length) return false;
    // Every item must have quantity > 0 and part label
    for (const item of items) {
      if (!item.poPartLabel?.trim()) return false;
      if (!item.dispatchedQty || Number(item.dispatchedQty) <= 0) return false;
      if (item.isExtraItem && !item.partNo?.trim()) return false;
    }
    return true;
  }, [vendorId, poNumber, expectedReturnDate, items]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    setIsSubmitting(true);
    const payload: CreateSplDcPayload = {
      vendorId,
      poNumber: poNumber.trim(),
      mercIndentId: poData?.mercIndentId,
      mercIndentNumber: poData?.indentNumber,
      layoutNumber: poData?.layoutNumber ?? undefined,
      expectedReturnDate: expectedReturnDate || undefined,
      remarks: remarks?.trim() || undefined,
      dispatchGroups: [
        {
          processName: processName.trim(),
          targetProcess: targetProcess || undefined,
          items: items.map((item) => ({
            poPartLabel: item.poPartLabel.trim(),
            mercItemId: item.mercItemId,
            partNo: item.partNo?.trim() || item.poPartLabel.trim(),
            dispatchedQty: Number(item.dispatchedQty),
            batchNo: item.batchNo?.trim() || undefined,
            description: item.description?.trim() || undefined,
            isExtraItem: Boolean(item.isExtraItem),
            productId: item.productId,
          })),
        },
      ],
    };

    try {
      const result = await deliveryChallanApi.createSplDc(payload);
      setGeneratedDc(result);
      toast.success(`SPL DC ${result.dcNumber} created successfully!`);
      // Open print preview in a new window/tab immediately
      window.open(`/dispatch/delivery-challan/${result.id}/print`, '_blank');
      // Scroll to top so the print card and options are immediately visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to create SPL DC';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            DC Type 3: Special Process Delivery Challan (SPL)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch material for MERC special orders with PO part labeling and external WIP tracking.
          </p>
        </div>
      </div>

      {/* Post-Generation Success Card with Print Action */}
      {generatedDc && (
        <div className="p-6 bg-purple-50 border border-purple-200 rounded-xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-purple-600 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  Delivery Challan Generated: <span className="font-mono text-purple-700 bg-white px-2.5 py-0.5 rounded-md border border-purple-200 shadow-2xs">{generatedDc.dcNumber}</span>
                </h3>
                <p className="text-xs text-purple-800 mt-1">
                  Special Process (SPL) external dispatch is authorized and tracked in the DC Movement WIP ledger.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-3.5 py-2 text-xs font-semibold text-purple-900 hover:bg-purple-100 rounded-lg border border-purple-200 bg-white transition-colors cursor-pointer"
              >
                Create Another DC
              </button>
              <button
                type="button"
                onClick={() => navigate('/dispatch/returns')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 bg-white transition-colors cursor-pointer"
              >
                <span>View in Returns</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => window.open(`/dispatch/delivery-challan/${generatedDc.id}/print`, '_blank')}
                className="inline-flex items-center gap-2 px-5 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Print Supplier DC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Boundary Notice Banner */}
      <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 shadow-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">
          <span className="font-semibold text-amber-950">Stock Boundary Notice: </span>
          SPL DC tracks WIP externally for MERC special orders. Raw stock balance is not reduced — material was already issued from MERC stores.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Vendor Authorization */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-6 uppercase tracking-wide border-b border-slate-100 pb-4">
            Vendor Authorization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Authorized External Vendor *
              </label>
              <SearchSelect
                value={vendorId}
                onChange={(val) => {
                  setVendorId(val);
                  const vendorSlas = (slaList as any[])?.filter((s: any) => s.vendorId === val) || [];
                  if (vendorSlas.length === 1 && !targetProcess) {
                    setTargetProcess(vendorSlas[0].processId);
                    if (vendorSlas[0].slaDays) {
                      const date = new Date();
                      date.setDate(date.getDate() + Number(vendorSlas[0].slaDays));
                      setExpectedReturnDate(date.toISOString().split('T')[0]);
                    }
                  }
                }}
                placeholder="Select Vendor..."
                options={sortedVendorList.map((v: any) => ({
                  id: v.id,
                  primary: v.name,
                  secondary: v.code ? `[${v.code}] ${v.category || ''}`.trim() : (v.category || ''),
                }))}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-700">
                  Expected Return Date *
                </label>
                {vendorId && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                    <Calendar className="w-3 h-3" /> SLA Tracked
                  </span>
                )}
              </div>
              <input
                type="date"
                required
                value={expectedReturnDate}
                onChange={(e) => setExpectedReturnDate(e.target.value)}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent tabular-nums cursor-pointer"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Universal SLA date. Auto-calculated based on process SLA or system default (7 days).
              </p>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100">
            <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter remarks (e.g. HT AND RETURN)..."
              className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Printed directly in the Remarks section on the physical Supplier DC.
            </p>
          </div>
        </div>

        {/* Section 2: PO Selection */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-4 uppercase tracking-wide border-b border-slate-100 pb-3">
            MERC Purchase Order Selection
          </h2>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            PO Number or Layout Number *
          </label>
          <div ref={poDropdownRef} className="relative max-w-xl">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full h-10 pl-3.5 pr-8 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase font-medium shadow-2xs"
                  placeholder="Type PO # or Layout # (e.g. 13, 1340, or AGIPL PO)..."
                  value={poNumber}
                  onFocus={() => setShowPoDropdown(true)}
                  onChange={(e) => {
                    setPoNumber(e.target.value);
                    setShowPoDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchPoItems();
                    } else if (e.key === 'Escape') {
                      setShowPoDropdown(false);
                    }
                  }}
                />
                {poNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      setPoNumber('');
                      setPoData(null);
                      setItems([]);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleFetchPoItems()}
                disabled={!poNumber.trim() || loadingPo}
                className="inline-flex items-center justify-center gap-2 px-5 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {loadingPo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loadingPo ? 'Loading...' : 'Fetch Items'}
              </button>
            </div>

            {/* Autocomplete Suggestions Dropdown */}
            {showPoDropdown && matchingPos.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-30 mt-1 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Available MERC Purchase Orders ({matchingPos.length})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Click to auto-load items</span>
                </div>
                {matchingPos.map((posItem: any) => (
                  <div
                    key={posItem.id}
                    onClick={() => handleSelectPo(posItem)}
                    className="p-3 hover:bg-blue-50/70 transition-colors cursor-pointer group flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-primary font-mono">
                        {posItem.actualPoNumber || posItem.poNumber}
                      </span>
                      {posItem.layoutNumber && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono">
                          Layout: {posItem.layoutNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      {posItem.customerName && (
                        <span>Customer: <strong className="text-slate-700">{posItem.customerName}</strong></span>
                      )}
                      <span>Indent: <strong className="text-slate-700">{posItem.indentNumber}</strong></span>
                      <span className="text-blue-600 font-medium">({posItem.lineItemCount} items)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Show PO details after fetch */}
          {poData && (
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center gap-8 text-sm text-slate-700">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Indent Number
                </span>
                <span className="font-semibold text-slate-900">{poData.indentNumber}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Customer
                </span>
                <span className="font-medium text-slate-900">{poData.customerName ?? '—'}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  Layout Number
                </span>
                <span className="font-mono text-slate-900">{poData.layoutNumber ?? '—'}</span>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                  PO Items Loaded
                </span>
                <span className="font-semibold text-blue-700">{items.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Dispatch Group & Items */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <h2 className="text-[15px] font-semibold text-slate-900 mb-2 uppercase tracking-wide border-b border-slate-100 pb-3">
            Dispatch Group & Line Items
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Process Name (Printed on DC)
              </label>
              <input
                type="text"
                value={processName}
                onChange={(e) => setProcessName(e.target.value)}
                placeholder="e.g. HEAT TREATMENT, SPARKING..."
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="mt-1 text-[11px] text-slate-500">Printed directly under Process on physical DC.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Target Production Process (Optional)
              </label>
              <select
                value={targetProcess}
                onChange={(e) => {
                  setTargetProcess(e.target.value);
                  const selected = (processList as any[])?.find((p: any) => p.id === e.target.value);
                  if (selected && !processName.trim()) {
                    setProcessName(selected.name);
                  }
                }}
                className="w-full h-10 px-3.5 rounded-lg bg-white border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              >
                <option value="">Select Process (Optional)...</option>
                {(processList as any[])?.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">Maps to internal production process master.</p>
            </div>
          </div>

          {/* Items Payload List */}
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Items Payload</h3>
                <p className="text-xs text-slate-500">
                  Specify the MERC PO items and extra stock parts being dispatched to the vendor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStockPicker(true)}
                disabled={!poData}
                title={!poData ? 'Please fetch a PO first to enable extra stock items' : ''}
                className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-4 h-4 text-primary" />
                + Add Item from Stock
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm bg-white rounded-lg border border-dashed border-slate-200">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No items added yet. Enter a PO Number above and click <strong>Fetch Items</strong>.
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold text-slate-500">
                          S.No. {String(index + 1).padStart(2, '0')}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                            item.isExtraItem
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : item.itemType === 'RAW_MATERIAL'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {item.isExtraItem
                            ? 'EXTRA STOCK ITEM'
                            : item.itemType === 'RAW_MATERIAL'
                            ? 'RAW MATERIAL'
                            : 'BOUGHT OUT'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* SC ITEM / COMPONENT PART NAME */}
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          SC ITEM / COMPONENT PART NAME *
                        </label>
                        <input
                          type="text"
                          required
                          value={item.poPartLabel}
                          onChange={(e) => updateItem(index, 'poPartLabel', e.target.value)}
                          readOnly={!item.isExtraItem}
                          className={`w-full h-9 px-3 rounded-lg border text-xs text-slate-900 focus:outline-none ${
                            !item.isExtraItem
                              ? 'bg-slate-50 border-slate-200 cursor-not-allowed font-medium'
                              : 'bg-white border-slate-300 focus:ring-2 focus:ring-primary'
                          }`}
                        />
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Printed as Part No / Particulars on DC (e.g. PO123 - BASE PLATE)
                        </p>
                      </div>

                      {/* Part No (auto or manual for extra) */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          PART NO. {!item.isExtraItem ? '(AUTO)' : '*'}
                        </label>
                        <input
                          type="text"
                          required={Boolean(item.isExtraItem)}
                          value={item.partNo}
                          onChange={(e) => updateItem(index, 'partNo', e.target.value)}
                          readOnly={!item.isExtraItem}
                          placeholder={item.isExtraItem ? 'Enter Part No' : ''}
                          className={`w-full h-9 px-3 rounded-lg border text-xs text-slate-900 focus:outline-none ${
                            !item.isExtraItem
                              ? 'bg-slate-50 border-slate-200 cursor-not-allowed font-mono'
                              : 'bg-white border-slate-300 focus:ring-2 focus:ring-primary'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                      {/* Dispatched Qty */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          DISPATCHED QUANTITY *
                        </label>
                        <input
                          type="number"
                          required
                          min={0.001}
                          step="any"
                          value={item.dispatchedQty}
                          onChange={(e) => updateItem(index, 'dispatchedQty', Number(e.target.value))}
                          className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary tabular-nums"
                        />
                      </div>

                      {/* Batch / Heat No */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          BATCH / HEAT NO. (OPTIONAL)
                        </label>
                        <input
                          type="text"
                          value={item.batchNo ?? ''}
                          onChange={(e) => updateItem(index, 'batchNo', e.target.value)}
                          placeholder="e.g. HT-992"
                          className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          DESCRIPTION / LINE NOTES
                        </label>
                        <input
                          type="text"
                          value={item.description ?? ''}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Specific instructions printed on DC..."
                          className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stock Picker Modal */}
        {showStockPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-slate-900">Add Item from Available Stock</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStockPicker(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                    placeholder="Search available products..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {filteredStockProducts.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-500">
                    No products with available stock match your search.
                  </div>
                ) : (
                  filteredStockProducts.map((prod) => (
                    <div
                      key={prod.productId}
                      onClick={() => addExtraItem(prod)}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-primary hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-900 group-hover:text-primary">
                          {prod.productName}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400">ID: {prod.productId}</div>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Stock: {prod.totalStock}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-end px-6 py-3 border-t border-slate-100 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setShowStockPicker(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action */}
        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sticky bottom-0 bg-white/95 backdrop-blur-sm -mx-4 -mb-4 px-4 py-3 sm:static sm:p-0 sm:bg-transparent sm:backdrop-blur-none sm:m-0 z-10">
          {!isFormValid && (
            <span className="text-xs text-amber-600 sm:mr-4 font-medium text-center sm:text-left">
              Please select Vendor, Return Date, fetch a PO, and ensure all items have Quantity &gt; 0.
            </span>
          )}
          <button
            type="submit"
            disabled={!isFormValid || isSubmitting}
            className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-8 h-12 bg-blue-600 text-white text-base sm:text-sm font-medium rounded-xl sm:rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-500/20 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            {isSubmitting ? 'Generating SPL DC...' : 'Lock & Generate Delivery Challan'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DcTypeSpl;

