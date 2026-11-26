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
  AlertTriangle,
} from 'lucide-react';
import { deliveryChallanApi, api, unwrapList } from '../../services/api';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DcLockModal } from '../../components/dc/DcLockModal';
import type {
  MercPoItemsResponse,
  SplDcItem,
  CreateSplDcPayload,
  AvailableStockProduct,
  ProductLockConflict,
  MercPoLineItem,
} from '../../types/delivery-challan.dto';

export interface PoSlot {
  id: string;
  poNumber: string;
  loading: boolean;
  poData: MercPoItemsResponse | null;
  showDropdown: boolean;
}

export function DcTypeSpl() {
  const navigate = useNavigate();

  // Vendor authorization state
  const [vendorId, setVendorId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [remarks, setRemarks] = useState('HT AND RETURN');

  // Multi-PO selection state
  const [poSlots, setPoSlots] = useState<PoSlot[]>([
    { id: 'slot-1', poNumber: '', loading: false, poData: null, showDropdown: false },
  ]);
  const poSlotsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch available MERC POs for autocomplete suggestions
  const { data: mercPosList = [] } = useQuery({
    queryKey: ['merc-pos-list'],
    queryFn: () => deliveryChallanApi.getMercPos(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Click outside listener for PO dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        poSlotsContainerRef.current &&
        !poSlotsContainerRef.current.contains(event.target as Node)
      ) {
        setPoSlots((prev) =>
          prev.map((s) => (s.showDropdown ? { ...s, showDropdown: false } : s))
        );
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter available POs matching input for a given search query
  const getMatchingPos = (qStr: string) => {
    const q = qStr.trim().toLowerCase();
    if (!q) {
      return mercPosList as any[];
    }
    return (mercPosList as any[]).filter((p: any) => {
      const matchPo = p.actualPoNumber && p.actualPoNumber.toLowerCase().includes(q);
      const matchDisplay = p.poNumber && p.poNumber.toLowerCase().includes(q);
      const matchLayout = p.layoutNumber && p.layoutNumber.toLowerCase().includes(q);
      const matchIndent = p.indentNumber && p.indentNumber.toLowerCase().includes(q);
      const matchCustomer = p.customerName && p.customerName.toLowerCase().includes(q);
      return matchPo || matchDisplay || matchLayout || matchIndent || matchCustomer;
    });
  };

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

  // Product-level Lock Modal state
  const [lockConflicts, setLockConflicts] = useState<ProductLockConflict[]>([]);
  const [showLockModal, setShowLockModal] = useState(false);

  // Reset form to create another SPL DC
  const handleResetForm = () => {
    setGeneratedDc(null);
    setLockConflicts([]);
    setShowLockModal(false);
    setPoSlots([
      { id: 'slot-1', poNumber: '', loading: false, poData: null, showDropdown: false },
    ]);
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
    }
  }, [vendorId, targetProcess, slaList]);

  // Update PO input text for a slot
  const updateSlotPoNumber = (slotId: string, val: string) => {
    setPoSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, poNumber: val, showDropdown: true } : s))
    );
  };

  const updateSlotDropdown = (slotId: string, show: boolean) => {
    setPoSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, showDropdown: show } : s))
    );
  };

  // Add another PO search slot
  const handleAddPoSlot = () => {
    setPoSlots((prev) => [
      ...prev,
      {
        id: `slot-${Date.now()}`,
        poNumber: '',
        loading: false,
        poData: null,
        showDropdown: false,
      },
    ]);
  };

  // Remove a PO slot and its items
  const handleRemovePoSlot = (slotId: string) => {
    const slot = poSlots.find((s) => s.id === slotId);
    const targetPo = slot?.poData?.poNumber;
    if (targetPo) {
      setItems((prev) => prev.filter((it) => it.poNumber !== targetPo));
    }
    setPoSlots((prev) => prev.filter((s) => s.id !== slotId));
    toast.success('Removed PO search');
  };

  // Clear a PO slot
  const handleClearPoSlot = (slotId: string) => {
    const slot = poSlots.find((s) => s.id === slotId);
    const targetPo = slot?.poData?.poNumber;
    if (targetPo) {
      setItems((prev) => prev.filter((it) => it.poNumber !== targetPo));
    }
    setPoSlots((prev) =>
      prev.map((s) =>
        s.id === slotId ? { ...s, poNumber: '', poData: null, showDropdown: false } : s
      )
    );
  };

  // Fetch MERC PO Items for a specific slot
  const handleFetchPoItems = async (slotId: string, explicitPo?: string) => {
    const slot = poSlots.find((s) => s.id === slotId);
    if (!slot) return;
    const targetPo = (explicitPo !== undefined ? explicitPo : slot.poNumber).trim();
    if (!targetPo) {
      toast.error('Please enter a PO Number or Layout Number');
      return;
    }

    // Duplicate check
    const duplicateSlot = poSlots.find(
      (s) => s.id !== slotId && s.poData?.poNumber?.toUpperCase() === targetPo.toUpperCase()
    );
    if (duplicateSlot) {
      toast.error(`PO ${targetPo} is already loaded in another search slot.`);
      return;
    }

    setPoSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, loading: true, showDropdown: false } : s))
    );

    try {
      const data = await deliveryChallanApi.getMercPoItems(targetPo);
      setPoSlots((prev) =>
        prev.map((s) =>
          s.id === slotId
            ? {
                ...s,
                loading: false,
                poNumber: data.poNumber || targetPo,
                poData: data,
                showDropdown: false,
              }
            : s
        )
      );
      toast.success(`Loaded PO ${data.poNumber} (${data.lineItems?.length || 0} product(s) available)`);
    } catch (err: any) {
      setPoSlots((prev) =>
        prev.map((s) => (s.id === slotId ? { ...s, loading: false, poData: null } : s))
      );
      const msg = err.response?.data?.message || err.message || 'PO not found in MERC indents';
      toast.error(msg);
    }
  };

  const handleSelectPo = (slotId: string, item: any) => {
    const selectedPo = item.actualPoNumber || item.poNumber || item.layoutNumber;
    setPoSlots((prev) =>
      prev.map((s) => (s.id === slotId ? { ...s, poNumber: selectedPo } : s))
    );
    handleFetchPoItems(slotId, selectedPo);
  };

  // PO line items across all loaded POs that have not yet been added to the dispatch list
  const availablePoLineItems = useMemo(() => {
    const addedKeys = new Set(
      items
        .filter((i) => !i.isExtraItem && i.mercItemId && i.poNumber)
        .map((i) => `${i.poNumber}::${i.mercItemId}`)
    );

    const list: Array<{
      poNumber: string;
      indentNumber: string;
      customerName: string | null;
      line: MercPoLineItem;
    }> = [];

    for (const slot of poSlots) {
      if (!slot.poData?.lineItems) continue;
      for (const line of slot.poData.lineItems) {
        const key = `${slot.poData.poNumber}::${line.mercItemId}`;
        if (!addedKeys.has(key)) {
          list.push({
            poNumber: slot.poData.poNumber,
            indentNumber: slot.poData.indentNumber,
            customerName: slot.poData.customerName,
            line,
          });
        }
      }
    }
    return list;
  }, [poSlots, items]);

  // Options for PO product dropdown SearchSelect
  const poProductOptions = useMemo(() => {
    return availablePoLineItems.map(({ poNumber, indentNumber, line }) => {
      const lock = line.lock;
      const itemCap = lock?.cap ?? lock?.baseline ?? null;
      const isLockedOut = Boolean(lock && itemCap !== null && (lock?.available ?? 0) <= 0);
      const hasPartialLock = Boolean(
        lock && itemCap !== null && lock.available > 0 && lock.available < itemCap
      );

      const typeLabel = line.itemType === 'RAW_MATERIAL' ? 'RAW MATERIAL' : 'BOUGHT OUT';
      const desc = [line.material, line.shape].filter(Boolean).join(' ');
      const qtyLabel = `Req Qty: ${line.quantityRequired ?? 1}`;

      let lockNote = '';
      if (isLockedOut) {
        lockNote = ' • ⚠️ LOCKED (Out on DC)';
      } else if (hasPartialLock && lock) {
        lockNote = ` • ⚠️ ${lock.available} of ${itemCap} Avail`;
      }

      return {
        id: `${poNumber}::${line.mercItemId}`,
        primary: `[${poNumber}] ${line.name}`,
        secondary: `[${typeLabel}] ${qtyLabel}${desc ? ` • ${desc}` : ''} • Indent: ${indentNumber}${lockNote}`,
      };
    });
  }, [availablePoLineItems]);

  // Add a product from any loaded MERC PO
  const handleAddPoItem = (compositeId: string) => {
    const [targetPo, targetMercItemId] = compositeId.split('::');
    const slot = poSlots.find((s) => s.poData?.poNumber === targetPo);
    if (!slot?.poData?.lineItems) return;

    const line = slot.poData.lineItems.find((l) => l.mercItemId === targetMercItemId);
    if (!line) return;

    const lock = line.lock;
    const itemCap = lock?.cap ?? lock?.baseline ?? null;
    const hasPriorDispatch = Boolean(lock && itemCap !== null);
    const isLockedOut = Boolean(hasPriorDispatch && (lock?.available ?? 0) <= 0);
    const hasPartialLock = Boolean(
      hasPriorDispatch &&
        lock &&
        itemCap !== null &&
        lock.available > 0 &&
        lock.available < itemCap,
    );

    let defaultQty = line.quantityRequired > 0 ? Number(line.quantityRequired) : 1;
    if (isLockedOut) {
      defaultQty = 0;
    } else if (hasPartialLock && lock && defaultQty > lock.available) {
      defaultQty = lock.available;
    }

    const newItem: SplDcItem = {
      poPartLabel: `${targetPo} - ${line.name}`,
      mercItemId: line.mercItemId,
      partNo: line.name || '',
      poNumber: targetPo,
      dispatchedQty: defaultQty,
      batchNo: '',
      description: [line.material, line.shape].filter(Boolean).join(' ') || '',
      isExtraItem: false,
      itemType: line.itemType,
      lock: line.lock,
      isSelected: !isLockedOut,
    };

    setItems((prev) => [...prev, newItem]);
    toast.success(`Added [${targetPo}] ${line.name}`);
  };

  // Add all available items from a specific loaded PO slot
  const handleAddAllFromSlot = (slotId: string) => {
    const slot = poSlots.find((s) => s.id === slotId);
    if (!slot?.poData?.lineItems) return;

    const targetPo = slot.poData.poNumber;
    const existingMercIds = new Set(
      items.filter((it) => it.poNumber === targetPo).map((it) => it.mercItemId)
    );

    const newItems: SplDcItem[] = [];
    for (const line of slot.poData.lineItems) {
      if (existingMercIds.has(line.mercItemId)) continue;

      const lock = line.lock;
      const itemCap = lock?.cap ?? lock?.baseline ?? null;
      const isLockedOut = Boolean(lock && itemCap !== null && (lock?.available ?? 0) <= 0);
      const hasPartialLock = Boolean(
        lock && itemCap !== null && lock.available > 0 && lock.available < itemCap
      );

      let defaultQty = line.quantityRequired > 0 ? Number(line.quantityRequired) : 1;
      if (isLockedOut) {
        defaultQty = 0;
      } else if (hasPartialLock && lock && defaultQty > lock.available) {
        defaultQty = lock.available;
      }

      newItems.push({
        poPartLabel: `${targetPo} - ${line.name}`,
        mercItemId: line.mercItemId,
        partNo: line.name || '',
        poNumber: targetPo,
        dispatchedQty: defaultQty,
        batchNo: '',
        description: [line.material, line.shape].filter(Boolean).join(' ') || '',
        isExtraItem: false,
        itemType: line.itemType,
        lock: line.lock,
        isSelected: !isLockedOut,
      });
    }

    if (newItems.length > 0) {
      setItems((prev) => [...prev, ...newItems]);
      toast.success(`Added ${newItems.length} products from ${targetPo}`);
    } else {
      toast('All products from this PO are already added');
    }
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

  // Active loaded PO slots
  const activeLoadedSlots = useMemo(() => poSlots.filter((s) => s.poData !== null), [poSlots]);
  const primaryPo = activeLoadedSlots[0]?.poData?.poNumber || '';

  // All distinct PO numbers across active items and slots
  const allSelectedPoNumbers = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.poNumber) set.add(it.poNumber);
    });
    activeLoadedSlots.forEach((s) => {
      if (s.poData?.poNumber) set.add(s.poData.poNumber);
    });
    return Array.from(set);
  }, [items, activeLoadedSlots]);

  const combinedPoNumber = allSelectedPoNumbers.join(', ');

  // Add extra item from stock
  const addExtraItem = (product: AvailableStockProduct) => {
    const targetPo = primaryPo || 'STOCK';
    const extraItem: SplDcItem = {
      poPartLabel: `${targetPo} - ${product.productName}`,
      partNo: '',
      poNumber: targetPo,
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

  // Available stock products combined across loaded slots
  const combinedStockProducts = useMemo(() => {
    const map = new Map<string, AvailableStockProduct>();
    for (const slot of activeLoadedSlots) {
      if (slot.poData?.availableStockProducts) {
        for (const p of slot.poData.availableStockProducts) {
          if (!map.has(p.productId)) {
            map.set(p.productId, p);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [activeLoadedSlots]);

  // Filter available stock products for picker modal
  const filteredStockProducts = useMemo(() => {
    const term = stockSearch.toLowerCase().trim();
    if (!term) return combinedStockProducts;
    return combinedStockProducts.filter(
      (p) =>
        p.productName.toLowerCase().includes(term) ||
        p.productId.toLowerCase().includes(term)
    );
  }, [combinedStockProducts, stockSearch]);

  // Form validity check
  const isFormValid = useMemo(() => {
    if (!vendorId) return false;
    if (!activeLoadedSlots.length) return false;
    if (!expectedReturnDate) return false;

    const activeItems = items.filter((item) => {
      const isLockedOut = item.lock && item.lock.baseline !== null && item.lock.available <= 0;
      return item.isSelected !== false && !isLockedOut;
    });

    if (!activeItems.length) return false;

    // Every active item must have quantity > 0 and part label
    for (const item of activeItems) {
      if (!item.poPartLabel?.trim()) return false;
      if (!item.dispatchedQty || Number(item.dispatchedQty) <= 0) return false;
      if (item.isExtraItem && !item.partNo?.trim()) return false;
    }
    return true;
  }, [vendorId, activeLoadedSlots, expectedReturnDate, items]);

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const activeItems = items.filter((item) => {
      const isLockedOut = item.lock && item.lock.baseline !== null && item.lock.available <= 0;
      return item.isSelected !== false && !isLockedOut;
    });

    // Client-side guard for product lock violation before network request
    const clientConflicts: ProductLockConflict[] = [];
    for (const item of activeItems) {
      if (item.lock && item.lock.baseline !== null) {
        if (Number(item.dispatchedQty) > item.lock.available + 0.0001) {
          clientConflicts.push({
            dcType: 'SPL_PROCESS',
            scNumber: null,
            poNumber: item.poNumber || primaryPo,
            productLabel: item.poPartLabel,
            requestedQty: Number(item.dispatchedQty),
            availableQty: item.lock.available,
            pendingQty: item.lock.outstanding,
            blockingDcs: item.lock.blockingDcs || [],
          });
        }
      }
    }

    if (clientConflicts.length > 0) {
      setLockConflicts(clientConflicts);
      setShowLockModal(true);
      return;
    }

    setIsSubmitting(true);
    const payload: CreateSplDcPayload = {
      vendorId,
      poNumber: combinedPoNumber || primaryPo,
      mercIndentId: activeLoadedSlots[0]?.poData?.mercIndentId,
      mercIndentNumber: activeLoadedSlots
        .map((s) => s.poData?.indentNumber)
        .filter(Boolean)
        .join(', '),
      layoutNumber:
        activeLoadedSlots
          .map((s) => s.poData?.layoutNumber)
          .filter(Boolean)
          .join(', ') || undefined,
      expectedReturnDate: expectedReturnDate || undefined,
      remarks: remarks?.trim() || undefined,
      dispatchGroups: [
        {
          processName: processName.trim(),
          targetProcess: targetProcess || undefined,
          items: activeItems.map((item) => ({
            poPartLabel: item.poPartLabel.trim(),
            mercItemId: item.mercItemId,
            partNo: item.partNo?.trim() || item.poPartLabel.trim(),
            poNumber: item.poNumber || primaryPo,
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
      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const errorData = err?.response?.data;
      const lockError =
        errorData?.error?.code === 'DC_PRODUCT_LOCKED'
          ? errorData.error
          : errorData?.code === 'DC_PRODUCT_LOCKED'
          ? errorData
          : null;

      if (lockError && Array.isArray(lockError.conflicts) && lockError.conflicts.length > 0) {
        setLockConflicts(lockError.conflicts);
        setShowLockModal(true);
        return;
      }

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
                  Delivery Challan Generated:{' '}
                  <span className="font-mono text-purple-700 bg-white px-2.5 py-0.5 rounded-md border border-purple-200 shadow-2xs">
                    {generatedDc.dcNumber}
                  </span>
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
                  if (val && !expectedReturnDate) {
                    const date = new Date();
                    date.setDate(date.getDate() + 7);
                    setExpectedReturnDate(date.toISOString().split('T')[0]);
                  }
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

        {/* Section 2: MERC Purchase Order Selection (Supports Multiple POs) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
                MERC Purchase Order Selection
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select one or more MERC Purchase Orders to include in this Delivery Challan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddPoSlot}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs font-bold rounded-lg transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
            >
              <Plus className="w-4 h-4 text-blue-600" />
              Add Another PO
            </button>
          </div>

          {/* List of PO Slots */}
          <div ref={poSlotsContainerRef} className="space-y-6">
            {poSlots.map((slot, index) => {
              const matchingPos = getMatchingPos(slot.poNumber);
              const poItemsCount = items.filter(
                (it) => it.poNumber === slot.poData?.poNumber
              ).length;

              return (
                <div
                  key={slot.id}
                  className={
                    index > 0
                      ? 'pt-6 border-t border-slate-200 space-y-4'
                      : 'space-y-4'
                  }
                >
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold text-slate-800">
                      PO Number or Layout Number {poSlots.length > 1 ? `(#${index + 1})` : ''} *
                    </label>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePoSlot(slot.id)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium hover:bg-red-50 px-2 py-1 rounded transition-colors cursor-pointer"
                        title="Remove this PO search"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove PO
                      </button>
                    )}
                  </div>

                  <div className="relative max-w-2xl">
                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                      <div className="relative flex-1 min-w-[240px]">
                        <input
                          type="text"
                          className="w-full h-10 pl-3.5 pr-8 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent uppercase font-medium shadow-2xs"
                          placeholder="Type PO # or Layout # (e.g. 730, 1368, or AGIPL PO)..."
                          value={slot.poNumber}
                          onFocus={() => updateSlotDropdown(slot.id, true)}
                          onChange={(e) => updateSlotPoNumber(slot.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleFetchPoItems(slot.id);
                            } else if (e.key === 'Escape') {
                              updateSlotDropdown(slot.id, false);
                            }
                          }}
                        />
                        {slot.poNumber && (
                          <button
                            type="button"
                            onClick={() => handleClearPoSlot(slot.id)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleFetchPoItems(slot.id)}
                        disabled={!slot.poNumber.trim() || slot.loading}
                        className="inline-flex items-center justify-center gap-2 px-5 h-10 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-xs cursor-pointer"
                      >
                        {slot.loading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Search className="w-4 h-4" />
                        )}
                        {slot.loading ? 'Loading...' : 'Fetch Items'}
                      </button>

                      {index === poSlots.length - 1 && (
                        <button
                          type="button"
                          onClick={handleAddPoSlot}
                          className="inline-flex items-center justify-center gap-1.5 px-4 h-10 bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-colors shrink-0 shadow-2xs cursor-pointer"
                          title="Add another PO search bar below"
                        >
                          <Plus className="w-3.5 h-3.5 text-primary" />
                          Add Another PO
                        </button>
                      )}
                    </div>

                    {/* Autocomplete Suggestions Dropdown for this slot */}
                    {slot.showDropdown && matchingPos.length > 0 && (
                      <div className="absolute left-0 right-0 top-11 z-30 mt-1 max-h-72 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 divide-y divide-slate-100">
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Available MERC Purchase Orders ({matchingPos.length})</span>
                          <span className="text-[10px] text-slate-400 font-normal">Click to auto-load</span>
                        </div>
                        {matchingPos.map((posItem: any) => (
                          <div
                            key={posItem.id}
                            onClick={() => handleSelectPo(slot.id, posItem)}
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
                                <span>
                                  Customer: <strong className="text-slate-700">{posItem.customerName}</strong>
                                </span>
                              )}
                              <span>
                                Indent: <strong className="text-slate-700">{posItem.indentNumber}</strong>
                              </span>
                              <span className="text-blue-600 font-medium">({posItem.lineItemCount} items)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Summary Bar for this loaded PO */}
                  {slot.poData && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-4 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            PO Number
                          </span>
                          <span className="font-bold text-blue-900 font-mono text-base">{slot.poData.poNumber}</span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            Indent Number
                          </span>
                          <span className="font-semibold text-slate-900">{slot.poData.indentNumber}</span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            Customer
                          </span>
                          <span className="font-medium text-slate-900">{slot.poData.customerName ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            Layout Number
                          </span>
                          <span className="font-mono text-slate-900">{slot.poData.layoutNumber ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            PO Products Available
                          </span>
                          <span className="font-semibold text-blue-700">{slot.poData.lineItems?.length ?? 0}</span>
                        </div>
                        <div>
                          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold block">
                            Selected For Dispatch
                          </span>
                          <span className="font-semibold text-emerald-700">{poItemsCount}</span>
                        </div>
                      </div>

                      {/* Quick Add All Available Items for this PO */}
                      <button
                        type="button"
                        onClick={() => handleAddAllFromSlot(slot.id)}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 hover:text-blue-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                      >
                        + Add All {slot.poData.lineItems?.length || 0} Products
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
                  if (e.target.value && !expectedReturnDate) {
                    const date = new Date();
                    date.setDate(date.getDate() + 7);
                    setExpectedReturnDate(date.toISOString().split('T')[0]);
                  }
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
          <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-4 mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Items Payload</h3>
                <p className="text-xs text-slate-500">
                  Select products from any loaded PO or add extra stock parts to dispatch.
                </p>
              </div>
              {activeLoadedSlots.length > 0 && (
                <div className="text-xs font-medium text-slate-600 bg-white px-3 py-1 rounded-md border border-slate-200 shadow-2xs">
                  <span>Selected: <strong className="text-blue-600">{items.length}</strong></span>
                  <span className="mx-2 text-slate-300">|</span>
                  <span>Available Across POs: <strong className="text-slate-800">{availablePoLineItems.length}</strong></span>
                </div>
              )}
            </div>

            {/* Product Selection Controls: PO Products Dropdown & Add Item from Stock Button */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-1 min-w-0">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Select Product from Loaded POs {combinedPoNumber ? `(${combinedPoNumber})` : ''}
                  </label>
                  <SearchSelect
                    value=""
                    onChange={(selectedId) => handleAddPoItem(selectedId)}
                    disabled={activeLoadedSlots.length === 0 || availablePoLineItems.length === 0}
                    placeholder={
                      activeLoadedSlots.length === 0
                        ? 'Fetch a PO order first to select products...'
                        : availablePoLineItems.length === 0
                        ? `All products from loaded POs have been added`
                        : `Choose product to dispatch (${availablePoLineItems.length} available)...`
                    }
                    searchPlaceholder="Search product by name, material, or part #..."
                    options={poProductOptions}
                  />
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowStockPicker(true)}
                    disabled={activeLoadedSlots.length === 0}
                    title={activeLoadedSlots.length === 0 ? 'Please fetch a PO first to enable extra stock items' : ''}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 h-11 sm:h-9 px-4 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl sm:rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-primary" />
                    + Add Item from Stock
                  </button>
                </div>
              </div>
              {activeLoadedSlots.length === 0 && (
                <p className="mt-2 text-[11px] text-slate-400 italic">
                  * Enter a PO number above and click &quot;Fetch Items&quot; to load products into the dropdown.
                </p>
              )}
            </div>

            {items.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm bg-white rounded-lg border border-dashed border-slate-200">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                {activeLoadedSlots.length > 0 ? (
                  <>
                    <p className="font-medium text-slate-700">No products selected for dispatch yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Select a product from the dropdown above or click <strong>+ Add Item from Stock</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-slate-700">No items added yet.</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Enter a PO Number above and click <strong>Fetch Items</strong>.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => {
                  const lock = item.lock;
                  const itemCap = lock?.cap ?? lock?.baseline ?? null;
                  const hasPriorDispatch = Boolean(lock && itemCap !== null);
                  const isLockedOut = Boolean(hasPriorDispatch && (lock?.available ?? 0) <= 0);
                  const hasPartialLock = Boolean(
                    hasPriorDispatch &&
                      lock &&
                      itemCap !== null &&
                      lock.available > 0 &&
                      lock.available < itemCap,
                  );
                  const blockingDcsSummary =
                    lock?.blockingDcs && lock.blockingDcs.length > 0
                      ? lock.blockingDcs
                          .map((d: any) => `${d.dcNumber} (${d.pendingQty} pending)`)
                          .join(', ')
                      : 'Open DC';
                  const singleBlockingDc = lock?.blockingDcs?.[0]?.dcNumber || 'Open DC';
                  const isSelected = item.isSelected !== false && !isLockedOut;

                  return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all space-y-4 shadow-2xs ${
                        isLockedOut
                          ? 'bg-slate-50/80 border-slate-300 opacity-85'
                          : isSelected
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50/50 border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isLockedOut}
                              onChange={(e) => updateItem(index, 'isSelected', e.target.checked)}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            />
                            <span
                              className={`text-xs font-mono font-bold ${
                                isLockedOut ? 'text-slate-400' : 'text-slate-700'
                              }`}
                            >
                              S.No. {String(index + 1).padStart(2, '0')}
                            </span>
                          </label>

                          {/* Respective PO Badge */}
                          {item.poNumber && (
                            <span className="px-2.5 py-0.5 text-[11px] font-bold font-mono rounded bg-slate-900 text-white shadow-2xs">
                              {item.poNumber}
                            </span>
                          )}

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

                          {/* Lock Status Badges */}
                          {isLockedOut && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                              <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                              Out on {lock?.blockingDcs && lock.blockingDcs.length > 1 ? 'Multiple DCs' : singleBlockingDc}
                            </span>
                          )}

                          {hasPartialLock && lock && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-bold rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              Partial Inward ({lock.available} of {itemCap} Available)
                            </span>
                          )}
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
                            Printed as Part No / Particulars on DC (e.g. {item.poNumber || 'PO'} - {item.partNo || 'PART'})
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
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-slate-700">
                              DISPATCHED QUANTITY *
                            </label>
                            {hasPartialLock && lock && (
                              <span className="text-[10px] font-bold text-amber-700 font-mono">
                                Max: {lock.available}
                              </span>
                            )}
                          </div>
                          <input
                            type="number"
                            required={!isLockedOut && isSelected}
                            disabled={isLockedOut || !isSelected}
                            min={isLockedOut ? 0 : 0.001}
                            max={hasPartialLock && lock ? lock.available : undefined}
                            step="any"
                            value={isLockedOut ? 0 : item.dispatchedQty}
                            onChange={(e) => updateItem(index, 'dispatchedQty', Number(e.target.value))}
                            className={`w-full h-9 px-3 rounded-lg border text-xs text-slate-900 focus:outline-none tabular-nums ${
                              isLockedOut || !isSelected
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : hasPartialLock && lock && Number(item.dispatchedQty) > lock.available
                                ? 'bg-rose-50 border-rose-300 text-rose-900 focus:ring-2 focus:ring-rose-500 font-bold'
                                : 'bg-white border-slate-300 focus:ring-2 focus:ring-primary font-semibold'
                            }`}
                          />
                          {/* Hints and Validation */}
                          {isLockedOut && lock ? (
                            <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5 shrink-0" />
                              All {itemCap} unit{itemCap === 1 ? '' : 's'} out on {lock?.blockingDcs && lock.blockingDcs.length > 1 ? `DCs: ${blockingDcsSummary}` : `DC ${blockingDcsSummary}`} (not yet inwarded).
                            </p>
                          ) : hasPartialLock && lock ? (
                            <p className="mt-1 text-[11px] font-medium text-amber-700 flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              {lock.outstanding} pending across {lock?.blockingDcs && lock.blockingDcs.length > 1 ? `DCs: ${blockingDcsSummary}` : `DC ${blockingDcsSummary}`}; up to {lock.available} can be dispatched
                            </p>
                          ) : null}
                          {hasPartialLock && lock && Number(item.dispatchedQty) > lock.available && (
                            <p className="mt-0.5 text-[10px] text-rose-600 font-bold">
                              Requested quantity exceeds available {lock.available} units.
                            </p>
                          )}
                        </div>

                        {/* Batch / Heat No */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            BATCH / HEAT NO. (OPTIONAL)
                          </label>
                          <input
                            type="text"
                            disabled={isLockedOut || !isSelected}
                            value={item.batchNo ?? ''}
                            onChange={(e) => updateItem(index, 'batchNo', e.target.value)}
                            placeholder="e.g. HT-992"
                            className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            DESCRIPTION / LINE NOTES
                          </label>
                          <input
                            type="text"
                            disabled={isLockedOut || !isSelected}
                            value={item.description ?? ''}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Specifications or dimensions"
                            className="w-full h-9 px-3 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
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
              Please select Vendor, Return Date, fetch at least one PO, and select products for dispatch.
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

      {/* Shared DC Product Lock Conflict Modal */}
      <DcLockModal
        isOpen={showLockModal}
        onClose={() => setShowLockModal(false)}
        conflicts={lockConflicts}
      />
    </div>
  );
}

export default DcTypeSpl;
