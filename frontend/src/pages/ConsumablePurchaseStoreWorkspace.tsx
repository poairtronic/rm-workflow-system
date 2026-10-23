import { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Printer,
  PackagePlus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  Bell,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ExportDropdown } from '../components/common/ExportDropdown';
import type { ExportColumn } from '../utils/exportUtils';
import { VelanPrPrintModal } from '../components/consumables/VelanPrPrintModal';
import { EditPrIndentModal } from '../components/consumables/EditPrIndentModal';
import { ConsumableAlertSettingsModal } from '../components/consumables/ConsumableAlertSettingsModal';
import { consumablesApi, type BinOption } from '../services/consumables.service';
import type { ConsumableLineItemRecord } from '../types/consumables.types';
import toast from 'react-hot-toast';

export function matchesPrNumber(itemPrNumber?: string | number | null, query?: string): boolean {
  if (!itemPrNumber || !query) return false;
  const cleanItemPr = String(itemPrNumber).trim().toLowerCase();
  const cleanQuery = query.trim().toLowerCase();

  // 1. Direct substring match (e.g. "27" in "27")
  if (cleanItemPr.includes(cleanQuery)) return true;

  // 2. Alphanumeric match (stripping spaces, symbols, e.g. "PR-27" -> "pr27" matches "27" or "pr 27")
  const strippedItemPr = cleanItemPr.replace(/[^0-9a-z]/g, '');
  const strippedQuery = cleanQuery.replace(/[^0-9a-z]/g, '');
  if (
    strippedItemPr &&
    strippedQuery &&
    (strippedItemPr.includes(strippedQuery) || strippedQuery.includes(strippedItemPr))
  ) {
    return true;
  }

  // 3. Digit-only match (e.g. "PR # 27" vs "27")
  const itemDigits = cleanItemPr.replace(/\D/g, '');
  const queryDigits = cleanQuery.replace(/\D/g, '');
  if (itemDigits && queryDigits && itemDigits === queryDigits) {
    return true;
  }

  return false;
}

export function ConsumablePurchaseStoreWorkspace() {
  const [activeTab, setActiveTab] = useState<'STOCK_QUEUE' | 'PURCHASE_QUEUE'>('STOCK_QUEUE');

  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Line items
  const [allItems, setAllItems] = useState<ConsumableLineItemRecord[]>([]);
  const [bins, setBins] = useState<BinOption[]>([]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'ALL' | 'OPEN' | 'PARTIALLY_ISSUED' | 'DISPATCHED'>('ALL');

  // Selection for Batch PR Print
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // PR Indent Edit & Safety Stock Modal State
  const [indentEditModalOpen, setIndentEditModalOpen] = useState(false);
  const [indentEditItems, setIndentEditItems] = useState<ConsumableLineItemRecord[]>([]);
  const [indentSubmitting, setIndentSubmitting] = useState(false);

  // PR Print Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printModalData, setPrintModalData] = useState<{
    prNumber: string;
    items: ConsumableLineItemRecord[];
    date?: string;
    paymentMode?: 'CASH' | 'CREDIT';
  } | null>(null);

  // Receive Purchase Modal State
  const [receiveModalItem, setReceiveModalItem] = useState<ConsumableLineItemRecord | null>(null);
  const [realReceivedQty, setRealReceivedQty] = useState<number>(0);
  const [selectedTargetBinId, setSelectedTargetBinId] = useState<string>('');
  const [receiveStockBins, setReceiveStockBins] = useState<
    Array<{
      binId: string;
      binCode: string;
      binName?: string;
      rackName?: string;
      currentQuantity: number;
    }>
  >([]);
  const [loadingReceiveBins, setLoadingReceiveBins] = useState(false);
  const [autoIssueOnReceive, setAutoIssueOnReceive] = useState<boolean>(true);
  const [deliveryToProductionQty, setDeliveryToProductionQty] = useState<number>(0);
  const [receivingSubmit, setReceivingSubmit] = useState(false);

  // Issue to Production Modal State
  const [issueModalItem, setIssueModalItem] = useState<ConsumableLineItemRecord | null>(null);
  const [issueQty, setIssueQty] = useState<number>(0);
  const [selectedSourceBinId, setSelectedSourceBinId] = useState<string>('');
  const [itemStockBins, setItemStockBins] = useState<
    Array<{
      binId: string;
      binCode: string;
      binName?: string;
      rackName?: string;
      currentQuantity: number;
    }>
  >([]);
  const [loadingStockBins, setLoadingStockBins] = useState(false);
  const [issuingSubmit, setIssuingSubmit] = useState(false);

  // Consumables SLA Alert Settings Modal State
  const [alertSettingsModalOpen, setAlertSettingsModalOpen] = useState(false);

  // Comprehensive Export Columns with Creation Timestamp
  const consumableExportColumns: ExportColumn<ConsumableLineItemRecord>[] = useMemo(
    () => [
      {
        header: 'Request #',
        key: 'requestCode',
        accessor: (item) => item.requestCode || 'N/A',
      },
      {
        header: 'PR #',
        key: 'prNumber',
        accessor: (item) => (item.prNumber ? `PR. No. ${item.prNumber}` : 'No PR assigned'),
      },
      {
        header: 'Creation Date & Time',
        key: 'createdAt',
        accessor: (item) => {
          if (!item.createdAt) return 'N/A';
          const d = new Date(item.createdAt);
          return isNaN(d.getTime())
            ? String(item.createdAt)
            : d.toLocaleString('en-IN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              });
        },
      },
      {
        header: 'Item Description',
        key: 'description',
        accessor: (item) => item.description || 'N/A',
      },
      {
        header: 'Product Code',
        key: 'productCode',
        accessor: (item) => item.productCode || '-',
      },
      {
        header: 'Category Track',
        key: 'itemCategoryTrack',
        accessor: (item) =>
          item.itemCategoryTrack === 'STOCK_ITEM' ? 'In-Stock Store Item' : 'Non-Stock / Purchase',
      },
      {
        header: 'Supplier / Vendor',
        key: 'vendorName',
        accessor: (item) => item.newVendorName || item.vendorName || 'Open Sourcing',
      },
      {
        header: 'Req. Qty (Production)',
        key: 'requestedQty',
        accessor: (item) => `${item.requestedQty || 0} ${item.uom || 'NOS'}`,
      },
      {
        header: 'Store Indent Qty',
        key: 'purchaseQty',
        accessor: (item) => `${item.purchaseQty ?? item.requestedQty ?? 0} ${item.uom || 'NOS'}`,
      },
      {
        header: 'Real Received Qty',
        key: 'realReceivedQty',
        accessor: (item) => `${item.realReceivedQty || 0} ${item.uom || 'NOS'}`,
      },
      {
        header: 'Issued to Production',
        key: 'issuedQty',
        accessor: (item) => `${item.issuedQty || 0} ${item.uom || 'NOS'}`,
      },
      {
        header: 'Retained Store Stock',
        accessor: (item) =>
          `${Math.max(0, Number(item.realReceivedQty || 0) - Number(item.issuedQty || 0))} ${item.uom || 'NOS'}`,
      },
      {
        header: 'Current Stage',
        key: 'status',
        accessor: (item) => {
          const isFull =
            (item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION') &&
            Number(item.issuedQty || 0) >= Number(item.requestedQty || 0);
          const isPart =
            item.status === 'PARTIALLY_ISSUED' ||
            (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0));
          if (isFull) return 'Dispatched (Closed)';
          if (isPart) return `Partially Issued (${item.issuedQty}/${item.requestedQty})`;
          if (item.status === 'PURCHASE_RECEIVED') return 'Stock Received';
          if (item.status === 'PURCHASE_REQUESTED') return 'PR Slip Printed';
          return 'Open';
        },
      },
      {
        header: 'End User / Bay',
        key: 'endUserInVelan',
        accessor: (item) => item.endUserInVelan || '-',
      },
      {
        header: 'Requested By',
        key: 'requestedBy',
        accessor: (item) => item.requestedBy || '-',
      },
    ],
    []
  );

  // Fetch items & bins
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [items, binList] = await Promise.all([
        consumablesApi.getLineItems(),
        consumablesApi.getWarehouseBins(),
      ]);
      setAllItems(items || []);
      setBins(binList || []);
      if (binList && binList.length > 0) {
        setSelectedTargetBinId((prev) => prev || binList[0].id);
        setSelectedSourceBinId((prev) => prev || binList[0].id);
      }
    } catch (err) {
      console.error('Failed to load store consumables data', err);
      toast.error('Failed to load consumable line items');
    } finally {
      setLoading(false);
    }
  };

  // --- SELECTION HELPERS FOR PR PRINT ---
  const handleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      const visibleIds = purchaseQueueItems.map((i) => i.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    } else {
      const visibleIds = new Set(purchaseQueueItems.map((i) => i.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // --- TRIGGER INDENT PREVIEW & EDIT FOR SINGLE LINE ITEM ---
  const handlePrintSingleItem = (item: ConsumableLineItemRecord) => {
    setIndentEditItems([item]);
    setIndentEditModalOpen(true);
  };

  // --- TRIGGER INDENT PREVIEW & EDIT FOR SELECTED LINE ITEMS ---
  const handlePrintSelectedPr = () => {
    const targetItems = allItems.filter((i) => selectedIds.includes(i.id));
    if (targetItems.length === 0) {
      toast.error('Please select at least one line item to print.');
      return;
    }
    setIndentEditItems(targetItems);
    setIndentEditModalOpen(true);
  };

  // --- CONFIRM EDITED INDENT & GENERATE / RE-PRINT OFFICIAL PR SLIP ---
  const handleConfirmIndentPrint = async (
    updatedItems: Array<{ id: string; purchaseQty: number; unitPrice?: number }>,
  ) => {
    setIndentSubmitting(true);
    try {
      const ids = updatedItems.map((u) => u.id);
      const res = await consumablesApi.printPurchaseRequisition({
        itemIds: ids,
        lineItemIds: ids,
        itemUpdates: updatedItems,
      });

      const itemsForSlip =
        res.items && res.items.length > 0
          ? res.items
          : indentEditItems.map((it) => {
              const match = updatedItems.find((u) => u.id === it.id);
              return match
                ? { ...it, purchaseQty: match.purchaseQty, unitPrice: match.unitPrice ?? it.unitPrice }
                : it;
            });

      setPrintModalData({
        prNumber: res.prNumber || (itemsForSlip[0]?.prNumber ? String(itemsForSlip[0].prNumber) : '1'),
        items: itemsForSlip,
        date: new Date().toISOString(),
        paymentMode: 'CASH',
      });

      setIndentEditModalOpen(false);
      setPrintModalOpen(true);
      setSelectedIds([]);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate Purchase Requisition');
    } finally {
      setIndentSubmitting(false);
    }
  };

  // --- RECEIVE PURCHASE SUBMISSION ---
  const handleOpenReceiveModal = async (item: ConsumableLineItemRecord) => {
    setReceiveModalItem(item);
    const req = Number(item.requestedQty) || 0;
    const rec = Number(item.realReceivedQty) || 0;
    const indent = Number(item.purchaseQty ?? req) || 0;
    // Quantity physically received from vendor defaults to indent/purchaseQty (e.g. 150)
    setRealReceivedQty(rec > 0 ? rec : (indent > 0 ? indent : (req > 0 ? req : 1)));
    // Quantity to immediately deliver to production strictly defaults to production request (e.g. 100)
    setDeliveryToProductionQty(req > 0 ? req : 1);
    setAutoIssueOnReceive(true);

    // Initial default: item's bin or first available bin in warehouse
    const initialBin = item.binId || (bins.length > 0 ? bins[0].id : '');
    setSelectedTargetBinId(initialBin);

    // Check if product already exists in a warehouse bin to auto-store there
    if (item.productId) {
      setLoadingReceiveBins(true);
      try {
        const stockBins = await consumablesApi.getProductStockBins(item.productId);
        setReceiveStockBins(stockBins || []);
        if (stockBins && stockBins.length > 0) {
          // If the item already has a designated bin that matches stock, preserve it; otherwise pick top stock bin
          const matching = item.binId && stockBins.some((sb) => sb.binId === item.binId);
          setSelectedTargetBinId(matching ? item.binId! : stockBins[0].binId);
        } else if (!initialBin && bins.length > 0) {
          setSelectedTargetBinId(bins[0].id);
        }
      } catch (err) {
        console.warn('Failed to query product stock bins for receive modal', err);
      } finally {
        setLoadingReceiveBins(false);
      }
    } else {
      setReceiveStockBins([]);
    }
  };

  const handleSubmitReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalItem) return;

    if (!selectedTargetBinId) {
      toast.error('Please select a Target Warehouse Bin.');
      return;
    }
    if (realReceivedQty <= 0) {
      toast.error('Real Received Qty must be greater than 0.');
      return;
    }
    if (autoIssueOnReceive && deliveryToProductionQty <= 0) {
      toast.error('Quantity to deliver to production must be greater than 0.');
      return;
    }
    if (autoIssueOnReceive && deliveryToProductionQty > realReceivedQty) {
      toast.error(
        `Cannot deliver ${deliveryToProductionQty} ${receiveModalItem.uom} to production: exceeds the ${realReceivedQty} ${receiveModalItem.uom} inwarded.`
      );
      return;
    }

    setReceivingSubmit(true);
    try {
      const issueQty = autoIssueOnReceive ? Number(deliveryToProductionQty) : 0;
      await consumablesApi.receivePurchase([
        {
          lineItemId: receiveModalItem.id,
          realReceivedQty: Number(realReceivedQty),
          binId: selectedTargetBinId,
          autoIssue: autoIssueOnReceive,
          issueQty,
        },
      ]);

      const retainedInStore = Math.max(0, realReceivedQty - issueQty);
      toast.success(
        autoIssueOnReceive
          ? `Inwarded ${realReceivedQty} ${receiveModalItem.uom} to bin: ${issueQty} ${receiveModalItem.uom} issued to Production, ${retainedInStore} ${receiveModalItem.uom} retained in stores inventory!`
          : `Inwarded ${realReceivedQty} ${receiveModalItem.uom} into stock bin!`
      );

      setReceiveModalItem(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to receive purchase');
      if (err?.message?.includes('status is') || err?.message?.includes('Cannot receive item')) {
        setReceiveModalItem(null);
        await loadData();
      }
    } finally {
      setReceivingSubmit(false);
    }
  };

  // --- STORE ISSUE TO PRODUCTION SUBMISSION ---
  const handleOpenIssueModal = async (item: ConsumableLineItemRecord) => {
    setIssueModalItem(item);
    const req = Number(item.requestedQty) || 0;
    const currentIssued = Number(item.issuedQty) || 0;
    const remainingNeeded = Math.max(0, req - currentIssued);
    // If partially issued, prefill with remaining quantity needed by production
    const defaultQty = remainingNeeded > 0 ? remainingNeeded : (req > 0 ? req : 1);
    setIssueQty(defaultQty);

    // Initial default bin (item.binId or first available bin)
    const initialBin = item.binId || (bins.length > 0 ? bins[0].id : '');
    setSelectedSourceBinId(initialBin);

    // Dynamically query bins holding actual stock for this product
    if (item.productId) {
      setLoadingStockBins(true);
      try {
        const stockBins = await consumablesApi.getProductStockBins(item.productId);
        setItemStockBins(stockBins || []);
        if (stockBins && stockBins.length > 0) {
          // If item already has an assigned bin with stock, preserve it; otherwise pick the bin with the highest stock
          const matching = item.binId && stockBins.some((sb) => sb.binId === item.binId);
          setSelectedSourceBinId(matching ? item.binId! : stockBins[0].binId);
        } else if (!initialBin && bins.length > 0) {
          setSelectedSourceBinId(bins[0].id);
        }
      } catch (err) {
        console.warn('Failed to load stock bins for product', err);
      } finally {
        setLoadingStockBins(false);
      }
    } else {
      setItemStockBins([]);
    }
  };

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueModalItem) return;

    if (!selectedSourceBinId) {
      toast.error('Please select a Source Bin for stock deduction.');
      return;
    }
    if (issueQty <= 0) {
      toast.error('Issue quantity must be greater than 0.');
      return;
    }

    setIssuingSubmit(true);
    setActionLoadingId(issueModalItem.id);
    try {
      await consumablesApi.issueToProduction(issueModalItem.id, {
        binId: selectedSourceBinId,
        issueQty: Number(issueQty),
      });

      toast.success(
        `Issued ${issueQty} ${issueModalItem.uom} to Production! Item routed to shop-floor receipt queue.`
      );

      setIssueModalItem(null);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to issue material to production');
      if (err?.message?.includes('status is') || err?.message?.includes('Cannot issue')) {
        setIssueModalItem(null);
        await loadData();
      }
    } finally {
      setIssuingSubmit(false);
      setActionLoadingId(null);
    }
  };

  // --- FILTERED QUEUES ---
  // Sub-Module 2A: In-Stock Queue
  const inStockItems = useMemo(() => {
    return allItems.filter((item) => {
      const isStockTrack =
        item.itemCategoryTrack === 'STOCK_ITEM' ||
        item.status === 'PURCHASE_RECEIVED' ||
        item.status === 'READY_FOR_ISSUE' ||
        item.status === 'PARTIALLY_ISSUED';
      if (!isStockTrack) return false;

      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const matchesSearch =
        item.description.toLowerCase().includes(q) ||
        item.requestCode?.toLowerCase().includes(q) ||
        (item.prNumber && matchesPrNumber(item.prNumber, q)) ||
        (item.endUserInVelan && item.endUserInVelan.toLowerCase().includes(q)) ||
        (item.requestedBy && item.requestedBy.toLowerCase().includes(q)) ||
        (item.vendorName && item.vendorName.toLowerCase().includes(q)) ||
        (item.productCode && item.productCode.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [allItems, searchQuery]);

  // Sub-Module 2B: Non-Stock / Purchase Queue
  const purchaseQueueItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allItems.filter((item) => {
      const isPurchaseTrack = item.itemCategoryTrack === 'NON_STOCK_OR_NEW';
      if (!isPurchaseTrack) return false;

      const isPrMatch = Boolean(item.prNumber && matchesPrNumber(item.prNumber, q));

      const isFull =
        (item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION') &&
        Number(item.issuedQty || 0) >= Number(item.requestedQty || 0);

      const isPart =
        item.status === 'PARTIALLY_ISSUED' ||
        (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0));

      // Filter tabs: Open (not fully dispatched), Partially Issued, or Dispatched
      if (!isPrMatch) {
        if (purchaseStatusFilter === 'OPEN' && isFull) {
          return false;
        }
        if (purchaseStatusFilter === 'PARTIALLY_ISSUED' && !isPart) {
          return false;
        }
        if (purchaseStatusFilter === 'DISPATCHED' && !isFull) {
          return false;
        }
      }

      if (!q) return true;

      const matchesSearch =
        item.description.toLowerCase().includes(q) ||
        item.requestCode?.toLowerCase().includes(q) ||
        isPrMatch ||
        (item.endUserInVelan && item.endUserInVelan.toLowerCase().includes(q)) ||
        (item.requestedBy && item.requestedBy.toLowerCase().includes(q)) ||
        (item.vendorName && item.vendorName.toLowerCase().includes(q)) ||
        (item.productCode && item.productCode.toLowerCase().includes(q));

      return matchesSearch;
    });
  }, [allItems, purchaseStatusFilter, searchQuery]);

  // Key KPI Metrics
  const readyForIssueCount = useMemo(
    () => allItems.filter((i) => {
      const isStockTrack =
        i.itemCategoryTrack === 'STOCK_ITEM' ||
        i.status === 'PURCHASE_RECEIVED' ||
        i.status === 'READY_FOR_ISSUE' ||
        i.status === 'PARTIALLY_ISSUED';
      const isFull = (i.status === 'ISSUED_TO_PRODUCTION' || i.status === 'RECEIVED_BY_PRODUCTION') && Number(i.issuedQty || 0) >= Number(i.requestedQty || 0);
      return isStockTrack && !isFull;
    }).length,
    [allItems]
  );

  const openPurchaseCount = useMemo(
    () => allItems.filter((i) => {
      if (i.itemCategoryTrack !== 'NON_STOCK_OR_NEW') return false;
      const isFull = (i.status === 'ISSUED_TO_PRODUCTION' || i.status === 'RECEIVED_BY_PRODUCTION') && Number(i.issuedQty || 0) >= Number(i.requestedQty || 0);
      return !isFull;
    }).length,
    [allItems]
  );

  const partiallyIssuedCount = useMemo(
    () => allItems.filter((i) => {
      const isPart = i.status === 'PARTIALLY_ISSUED' || (Number(i.issuedQty || 0) > 0 && Number(i.issuedQty || 0) < Number(i.requestedQty || 0));
      return isPart;
    }).length,
    [allItems]
  );

  const dispatchedCount = useMemo(
    () => allItems.filter((i) => {
      const isFull = (i.status === 'ISSUED_TO_PRODUCTION' || i.status === 'RECEIVED_BY_PRODUCTION') && Number(i.issuedQty || 0) >= Number(i.requestedQty || 0);
      return isFull;
    }).length,
    [allItems]
  );

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Header */}
      <PageHeader
        title="Consumable Purchase & Store Fulfillment"
        subtitle="Module 2: In-stock store issuance, Velan Metrology PR slip printing, real quantity stock-in, and shop-floor dispatch"
        actionSlot={
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('STOCK_QUEUE')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'STOCK_QUEUE'
                  ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Boxes className={`w-3.5 h-3.5 ${activeTab === 'STOCK_QUEUE' ? 'text-indigo-600 dark:text-white' : 'text-slate-400'}`} />
              <span>In-Stock Store Queue</span>
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${activeTab === 'STOCK_QUEUE'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-white/20 dark:text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
              >
                {readyForIssueCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('PURCHASE_QUEUE')}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${activeTab === 'PURCHASE_QUEUE'
                  ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <Building2 className={`w-3.5 h-3.5 ${activeTab === 'PURCHASE_QUEUE' ? 'text-amber-500 dark:text-white' : 'text-slate-400'}`} />
              <span>Purchase Queue</span>
              <span
                className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${activeTab === 'PURCHASE_QUEUE'
                    ? 'bg-amber-50 text-amber-700 dark:bg-white/20 dark:text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
              >
                {openPurchaseCount}
              </span>
            </button>
          </div>
        }
      />

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ready for Issue</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{readyForIssueCount}</p>
          <span className="text-[11px] text-slate-400">In-stock & available items</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Open Purchase Items</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{openPurchaseCount}</p>
          <span className="text-[11px] text-slate-400">Active procurement requests</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Partially Issued</span>
            <Send className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{partiallyIssuedCount}</p>
          <span className="text-[11px] text-slate-400">Partial delivery, awaiting balance</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Dispatched (Closed)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{dispatchedCount}</p>
          <span className="text-[11px] text-slate-400">100% full quantity issued</span>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: IN-STOCK LINE ITEMS QUEUE (STORE ISSUANCE)           */}
      {/* ============================================================ */}
      {activeTab === 'STOCK_QUEUE' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Boxes className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  In-Stock Consumables Queue (Ready for Issue)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Line items with stock available in warehouse bins. Issue directly to Production to execute atomic STOCK_OUT.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter stock items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <ExportDropdown
                data={inStockItems}
                columns={consumableExportColumns}
                fileName={`consumable_in_stock_${new Date().toISOString().split('T')[0]}`}
                reportTitle="Velan Metrology - In-Stock Consumables Report"
                reportSubtitle={`In-Stock Consumables Queue (${inStockItems.length} records)`}
                buttonLabel="Export Report"
                variant="button"
              />

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAlertSettingsModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Consumables SLA & Email Alert Settings"
              >
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Alerts
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3.5 w-36 align-middle">Request #</th>
                  <th className="py-3 px-3.5 min-w-[220px] align-middle">Item Description</th>
                  <th className="py-3 px-3.5 w-40 align-middle">End User / Bay</th>
                  <th className="py-3 px-3.5 w-36 align-middle">Requested By</th>
                  <th className="py-3 px-3.5 w-32 font-mono text-right align-middle">Avail. Stock</th>
                  <th className="py-3 px-3.5 w-28 font-mono text-right align-middle">Req. Qty</th>
                  <th className="py-3 px-3.5 w-40 text-center align-middle">Status</th>
                  <th className="py-3 px-3.5 w-48 text-center align-middle">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading in-stock queue...
                    </td>
                  </tr>
                ) : inStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No in-stock items currently pending issuance.
                    </td>
                  </tr>
                ) : (
                  inStockItems.map((item) => {
                    const isFullyIssued =
                      (item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION') &&
                      Number(item.issuedQty || 0) >= Number(item.requestedQty || 0);

                    const isPartial =
                      item.status === 'PARTIALLY_ISSUED' ||
                      (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0));

                    const remainingQty = Math.max(0, Number(item.requestedQty || 0) - Number(item.issuedQty || 0));

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-3.5 font-mono font-semibold text-slate-900 dark:text-white align-middle">
                          <span>{item.requestCode}</span>
                          {item.createdAt && (
                            <div
                              className="flex items-center gap-1 text-[10px] text-slate-400 font-normal font-sans mt-0.5 whitespace-nowrap"
                              title={`Created at: ${new Date(item.createdAt).toLocaleString('en-IN')}`}
                            >
                              <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>
                                {new Date(item.createdAt).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          )}
                          {item.prNumber && (
                            <button
                              type="button"
                              onClick={() => handlePrintSingleItem(item)}
                              className="mt-1 px-1.5 py-0.5 rounded-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 font-bold block w-fit text-[10px] cursor-pointer flex items-center gap-1 transition-colors"
                              title="Click to view & print official Velan Purchase Requisition slip for this item"
                            >
                              <Printer className="w-2.5 h-2.5" />
                              PR #{item.prNumber}
                            </button>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 align-middle">
                          <span className="font-semibold text-slate-900 dark:text-white block leading-snug">
                            {item.description}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.productCode || 'CONS'} • {item.uom}
                          </span>
                        </td>
                        <td className="py-3.5 px-3.5 text-slate-700 dark:text-slate-300 align-middle">
                          {item.endUserInVelan || 'Plant General'}
                        </td>
                        <td className="py-3.5 px-3.5 text-slate-600 dark:text-slate-400 align-middle">
                          {item.requestedBy}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-right font-bold text-purple-700 dark:text-purple-400 align-middle">
                          {Number(item.stockAvailableAtRequest || 0)} {item.uom}
                        </td>
                        <td className="py-3.5 px-3.5 font-mono text-right font-bold text-slate-900 dark:text-white align-middle">
                          {Number(item.requestedQty || 0)} {item.uom}
                        </td>
                        <td className="py-3.5 px-3.5 align-middle text-center">
                          <div className="inline-flex justify-center">
                            {isFullyIssued ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                Dispatched
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                                Open (Partial: {item.issuedQty} / {item.requestedQty} {item.uom})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                                Open
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-3.5 text-center align-middle">
                          {isFullyIssued ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-md">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              Dispatched
                            </span>
                          ) : isPartial ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenIssueModal(item)}
                              disabled={actionLoadingId === item.id}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs mx-auto cursor-pointer px-3 py-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Issue Remaining ({remainingQty} {item.uom})
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenIssueModal(item)}
                              disabled={actionLoadingId === item.id}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs mx-auto cursor-pointer px-3 py-1.5"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Issue to Production
                            </Button>
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

      {/* ============================================================ */}
      {/* TAB 2: NON-STOCK & NEW PRODUCTS (PURCHASE REQUISITIONS)     */}
      {/* ============================================================ */}
      {activeTab === 'PURCHASE_QUEUE' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shadow-2xs shrink-0">
                <Building2 className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Purchase Queue: Out-of-Stock & New Products
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select OPEN items to print official Velan Metrology Purchase Requisitions (starting at #1). Inward stock upon delivery.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Batch Print Button */}
              {selectedIds.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handlePrintSelectedPr()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-sm animate-pulse cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Selected PR ({selectedIds.length})
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAlertSettingsModalOpen(true)}
                className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Configure 24h unreceived & partial issue email/in-app alert triggers"
              >
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Alert Settings
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Sub-Filters & Search & Filter-wise Export */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-2">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search purchase items, PR #, requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
              <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100/80 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('ALL')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    purchaseStatusFilter === 'ALL'
                      ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Purchase Items
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('OPEN')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    purchaseStatusFilter === 'OPEN'
                      ? 'bg-white dark:bg-blue-600 text-blue-700 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Open ({openPurchaseCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('PARTIALLY_ISSUED')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    purchaseStatusFilter === 'PARTIALLY_ISSUED'
                      ? 'bg-white dark:bg-amber-600 text-amber-700 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Partially Issued ({partiallyIssuedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseStatusFilter('DISPATCHED')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                    purchaseStatusFilter === 'DISPATCHED'
                      ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Dispatched ({dispatchedCount})
                </button>
              </div>

              {/* Filter-wise Export Dropdown: exports whatever filtered items are currently active */}
              <ExportDropdown
                data={purchaseQueueItems}
                columns={consumableExportColumns}
                fileName={`consumable_purchase_${purchaseStatusFilter.toLowerCase()}_report_${new Date().toISOString().split('T')[0]}`}
                reportTitle={`Velan Metrology - Consumable Purchase Report (${
                  purchaseStatusFilter === 'ALL'
                    ? 'All Items'
                    : purchaseStatusFilter === 'OPEN'
                    ? 'Open Items'
                    : purchaseStatusFilter === 'PARTIALLY_ISSUED'
                    ? 'Partially Issued Items'
                    : 'Dispatched Items'
                })`}
                reportSubtitle={`Active Filter: ${purchaseStatusFilter} | Line Items: ${purchaseQueueItems.length} records | Creation Date & Time Included`}
                buttonLabel="Export Report"
                variant="button"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 w-10 text-center align-middle">
                    <input
                      type="checkbox"
                      checked={
                        purchaseQueueItems.length > 0 &&
                        purchaseQueueItems.every((i) => selectedIds.includes(i.id))
                      }
                      onChange={(e) => handleSelectAllVisible(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select all items in purchase queue"
                    />
                  </th>
                  <th className="py-3 px-3.5 w-36 align-middle">PR # / Req #</th>
                  <th className="py-3 px-3.5 min-w-[200px] align-middle">Item Description</th>
                  <th className="py-3 px-3.5 min-w-[170px] align-middle">Supplier / Vendor</th>
                  <th className="py-3 px-3.5 w-32 font-mono text-right align-middle">Req. / Indent Qty</th>
                  <th className="py-3 px-3.5 w-44 font-mono text-right align-middle">Real Received Qty</th>
                  <th className="py-3 px-3.5 w-40 text-center align-middle">Current Stage</th>
                  <th className="py-3 px-3.5 w-52 text-center align-middle">Procurement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading purchase queue...
                    </td>
                  </tr>
                ) : purchaseQueueItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No purchase queue items match your filter.
                    </td>
                  </tr>
                ) : (
                  purchaseQueueItems.map((item) => {
                    const isFullyIssued =
                      (item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION') &&
                      Number(item.issuedQty || 0) >= Number(item.requestedQty || 0);

                    const isPartial =
                      item.status === 'PARTIALLY_ISSUED' ||
                      (Number(item.issuedQty || 0) > 0 && Number(item.issuedQty || 0) < Number(item.requestedQty || 0));

                    const remainingQty = Math.max(0, Number(item.requestedQty || 0) - Number(item.issuedQty || 0));

                    const isOpenWithoutPr = !isFullyIssued && !isPartial && !item.prNumber;
                    const isPrAssignedPendingReceive = !isFullyIssued && !isPartial && Boolean(item.prNumber) && (Number(item.realReceivedQty || 0) === 0);
                    const isReceivedPendingIssue = !isFullyIssued && !isPartial && (Number(item.realReceivedQty || 0) > 0);

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${selectedIds.includes(item.id)
                            ? 'bg-indigo-50/60 dark:bg-indigo-950/30'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                          }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3.5 px-3 text-center align-middle">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title="Select line item for PR print"
                          />
                        </td>

                        {/* PR # / Req # */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex flex-col gap-1 items-start">
                            {item.prNumber ? (
                              <button
                                type="button"
                                onClick={() => handlePrintSingleItem(item)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 font-mono font-bold text-[11px] cursor-pointer transition-colors shadow-2xs"
                                title="Click to view & print official Velan Purchase Requisition slip"
                              >
                                <Printer className="w-3 h-3 text-indigo-500" />
                                PR. No. {item.prNumber}
                              </button>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">No PR assigned</span>
                            )}
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 pl-0.5">
                              {item.requestCode}
                            </span>
                            {item.createdAt && (
                              <div
                                className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 pl-0.5 whitespace-nowrap"
                                title={`Created: ${new Date(item.createdAt).toLocaleString('en-IN')}`}
                              >
                                <Clock className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                                <span>
                                  {new Date(item.createdAt).toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            )}
                            {/* Visual Overdue SLA Badge if unreceived > 24h */}
                            {(isOpenWithoutPr || isPrAssignedPendingReceive) &&
                              item.createdAt &&
                              Date.now() - new Date(item.createdAt).getTime() >= 24 * 60 * 60 * 1000 && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 mt-0.5">
                                  <Clock className="w-2.5 h-2.5 text-rose-600" />
                                  Unreceived &gt;24h
                                </span>
                              )}
                          </div>
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 dark:text-white leading-snug">
                                {item.description}
                              </span>
                              {item.isNewProduct && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800">
                                  Auto-Created
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.productCode || 'CONS'} • {item.uom}
                            </span>
                          </div>
                        </td>

                        {/* Vendor Context */}
                        <td className="py-3.5 px-3.5 align-middle">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-900 dark:text-white leading-snug">
                              {item.vendorName || item.newVendorName || 'Open Sourcing'}
                            </span>
                            {item.isNewVendor && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit">
                                New Supplier
                              </span>
                            )}
                            {(item.newVendorMobile || item.newVendorAddress) && (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                {item.newVendorMobile || item.newVendorAddress}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Req / Indent Qty */}
                        <td className="py-3.5 px-3.5 font-mono text-right align-middle font-semibold text-slate-800 dark:text-slate-200">
                          {(() => {
                            const indentQty = Number(item.purchaseQty ?? item.requestedQty ?? 0);
                            const prodReq = Number(item.requestedQty || 0);
                            const hasExtra = item.purchaseQty != null && Number(item.purchaseQty) !== prodReq;
                            if (hasExtra) {
                              return (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {indentQty} {item.uom}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-sans font-normal">
                                    Prod Req: {prodReq} {item.uom}
                                  </span>
                                </div>
                              );
                            }
                            return `${prodReq} ${item.uom}`;
                          })()}
                        </td>

                        {/* Real Received Qty & Retained Stores Stock */}
                        <td className="py-3.5 px-3.5 font-mono text-right align-middle">
                          {Number(item.realReceivedQty || 0) > 0 ? (
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                                {item.realReceivedQty} {item.uom}
                              </span>
                              {Number(item.issuedQty) > 0 && Number(item.realReceivedQty) > Number(item.issuedQty) && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800/50 whitespace-nowrap">
                                  <span>{item.issuedQty} issued</span>
                                  <span className="text-purple-300 dark:text-purple-600">•</span>
                                  <span>{Number(item.realReceivedQty) - Number(item.issuedQty)} stores</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status / Current Stage */}
                        <td className="py-3.5 px-3.5 align-middle text-center">
                          <div className="inline-flex justify-center">
                            {isFullyIssued ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                Dispatched
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 whitespace-nowrap">
                                Open (Partial: {item.issuedQty} / {item.requestedQty} {item.uom})
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                                Open
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3.5 align-middle text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            {/* Completed: Dispatched indicator with optional re-print icon */}
                            {isFullyIssued && (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  Dispatched
                                </span>
                                {item.prNumber && (
                                  <button
                                    type="button"
                                    onClick={() => handlePrintSingleItem(item)}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Re-print PR Slip"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Partially Issued: Issue Remaining */}
                            {isPartial && (
                              <div className="inline-flex items-center gap-1.5">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenIssueModal(item)}
                                  className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer px-3 py-1"
                                >
                                  <Send className="w-3 h-3" />
                                  Issue Remaining ({remainingQty} {item.uom})
                                </Button>
                                {item.prNumber && (
                                  <button
                                    type="button"
                                    onClick={() => handlePrintSingleItem(item)}
                                    className="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Re-print PR Slip"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Open: Print PR (if no PR assigned yet) */}
                            {isOpenWithoutPr && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePrintSingleItem(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer px-3 py-1"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Print PR Slip
                              </Button>
                            )}

                            {/* Open: PR Assigned & Pending Vendor Receipt */}
                            {isPrAssignedPendingReceive && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handlePrintSingleItem(item)}
                                  className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer border border-indigo-200 dark:border-indigo-800 px-2.5 py-1"
                                  title="View or re-print official Velan PR slip"
                                >
                                  <Printer className="w-3 h-3" />
                                  Print Slip
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleOpenReceiveModal(item)}
                                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer px-3 py-1"
                                >
                                  <PackagePlus className="w-3.5 h-3.5" />
                                  Mark Received
                                </Button>
                              </>
                            )}

                            {/* Open: Goods Received in store & Ready to Issue */}
                            {isReceivedPendingIssue && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenIssueModal(item)}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer px-3 py-1"
                              >
                                <Send className="w-3 h-3" />
                                Issue to Floor
                              </Button>
                            )}
                          </div>
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

      {/* ============================================================ */}
      {/* MODAL 1: PURCHASE RECEIPT & REAL QTY INWARD MODAL           */}
      {/* ============================================================ */}
      {receiveModalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PackagePlus className="w-5 h-5 text-cyan-600" />
                Receive Consumable Purchase
              </h3>
              <button
                type="button"
                onClick={() => setReceiveModalItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReceive} className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Item to Inward</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{receiveModalItem.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>Req. Qty: <b>{receiveModalItem.requestedQty} {receiveModalItem.uom}</b></span>
                  {receiveModalItem.purchaseQty != null && Number(receiveModalItem.purchaseQty) !== Number(receiveModalItem.requestedQty) && (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      Stores Indent Qty: <b>{receiveModalItem.purchaseQty} {receiveModalItem.uom}</b>
                    </span>
                  )}
                  {receiveModalItem.prNumber && <span>PR. No: <b>{receiveModalItem.prNumber}</b></span>}
                  <span>End User: <b>{receiveModalItem.endUserInVelan || 'Plant'}</b></span>
                </div>
              </div>

              {/* Editable Real Quantity Received */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Real Quantity Received (Physical Delivery Count) *
                </label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  value={realReceivedQty}
                  onChange={(e) => setRealReceivedQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                />
                <span className="text-[11px] text-slate-400 mt-0.5 block">
                  You can override the requested qty with the exact quantity supplied by the vendor.
                </span>
              </div>

              {/* Target Warehouse Bin */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    Target Warehouse Bin (STOCK_IN Location) *
                  </label>
                  {loadingReceiveBins && (
                    <span className="text-[11px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Auto-detecting stock location...
                    </span>
                  )}
                </div>
                <select
                  required
                  value={selectedTargetBinId}
                  onChange={(e) => setSelectedTargetBinId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="">-- Choose destination bin --</option>
                  {receiveStockBins.length > 0 && (
                    <optgroup label="Existing Product Storage Location (Auto-Selected)">
                      {receiveStockBins.map((sb) => (
                        <option key={sb.binId} value={sb.binId}>
                          {sb.binCode} {sb.binName ? `(${sb.binName})` : ''} {sb.rackName ? `• Rack: ${sb.rackName}` : ''} — [{sb.currentQuantity} {receiveModalItem.uom} currently in bin]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={receiveStockBins.length > 0 ? "All Other Warehouse Locations (Change Location)" : "All Warehouse Locations (108 Bins)"}>
                    {bins
                      .filter((b) => !receiveStockBins.some((sb) => sb.binId === b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} {b.name && b.name !== b.code ? `(${b.name})` : ''} {b.rack?.name ? `• Rack: ${b.rack.name}` : ''}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Storage location auto-selected. You can choose any other warehouse location from the list to store elsewhere.
                </p>
              </div>

              {/* Auto-Issue Toggle */}
              <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">
                    Fast-Track: Immediately Issue to Production
                  </span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    Inwards full purchased quantity to bin, then automatically dispatches the requested quantity to Production.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={autoIssueOnReceive}
                  onChange={(e) => setAutoIssueOnReceive(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-sm focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              {/* Delivery to Production breakdown when auto-issuing */}
              {autoIssueOnReceive && (
                <div className="p-3.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/60 dark:bg-purple-950/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-900 dark:text-purple-300">
                      Quantity to Deliver to Production *
                    </label>
                    <span className="text-[11px] text-purple-700 dark:text-purple-400">
                      Requested: <b>{receiveModalItem.requestedQty} {receiveModalItem.uom}</b>
                    </span>
                  </div>
                  <input
                    type="number"
                    required
                    min="0.001"
                    max={realReceivedQty}
                    step="any"
                    value={deliveryToProductionQty}
                    onChange={(e) => setDeliveryToProductionQty(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-mono font-bold rounded-lg border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                  />
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-purple-200 dark:border-purple-900/60 font-medium">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Retained in Stores Bin: <b>{Math.max(0, realReceivedQty - deliveryToProductionQty)} {receiveModalItem.uom}</b>
                    </span>
                    <span className="text-purple-700 dark:text-purple-400">
                      Dispatched to Production: <b>{deliveryToProductionQty} {receiveModalItem.uom}</b>
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setReceiveModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={receivingSubmit}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs"
                >
                  {receivingSubmit ? 'Inwarding...' : 'Confirm Stock-In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: STORE ISSUE TO PRODUCTION MODAL                    */}
      {/* ============================================================ */}
      {issueModalItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-purple-600" />
                Store Issue to Production (STOCK_OUT)
              </h3>
              <button
                type="button"
                onClick={() => setIssueModalItem(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitIssue} className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-xs text-slate-400 uppercase font-semibold">Material to Issue</span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{issueModalItem.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>Req. Qty: <b>{issueModalItem.requestedQty} {issueModalItem.uom}</b></span>
                  {Number(issueModalItem.issuedQty) > 0 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Already Issued: <b>{issueModalItem.issuedQty} {issueModalItem.uom}</b>
                    </span>
                  )}
                  {Number(issueModalItem.issuedQty) > 0 && (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      Remaining Needed: <b>{Math.max(0, Number(issueModalItem.requestedQty) - Number(issueModalItem.issuedQty))} {issueModalItem.uom}</b>
                    </span>
                  )}
                  <span>End User: <b>{issueModalItem.endUserInVelan || 'Plant Floor'}</b></span>
                  <span>Requester: <b>{issueModalItem.requestedBy}</b></span>
                </div>
              </div>

              {/* Source Bin */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">
                    Source Warehouse Bin (STOCK_OUT Deduction) *
                  </label>
                  {loadingStockBins && (
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 flex items-center gap-1 font-medium">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Auto-detecting stock bin...
                    </span>
                  )}
                </div>
                <select
                  required
                  value={selectedSourceBinId}
                  onChange={(e) => setSelectedSourceBinId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Choose source bin --</option>
                  {itemStockBins.length > 0 && (
                    <optgroup label="Bins With Available Stock (Auto-Selected)">
                      {itemStockBins.map((sb) => (
                        <option key={sb.binId} value={sb.binId}>
                          {sb.binCode} {sb.binName ? `(${sb.binName})` : ''} {sb.rackName ? `• Rack: ${sb.rackName}` : ''} — [{sb.currentQuantity} {issueModalItem.uom} available]
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label={itemStockBins.length > 0 ? "Other Warehouse Bins (Change Location)" : "All Warehouse Bins"}>
                    {bins
                      .filter((b) => !itemStockBins.some((sb) => sb.binId === b.id))
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} {b.name ? `(${b.name})` : ''} {b.rack?.name ? `• Rack: ${b.rack.name}` : ''}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Optimal warehouse bin auto-selected. You can select any other bin from the dropdown if needed.
                </p>
              </div>

              {/* Issue Quantity */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600 dark:text-slate-400 mb-1">
                  Quantity to Issue ({issueModalItem.uom}) *
                </label>
                <input
                  type="number"
                  required
                  min="0.001"
                  max={Math.max(0, Number(issueModalItem.requestedQty) - Number(issueModalItem.issuedQty || 0))}
                  step="any"
                  value={issueQty}
                  onChange={(e) => setIssueQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Remaining needed by production: {Math.max(0, Number(issueModalItem.requestedQty) - Number(issueModalItem.issuedQty || 0))} {issueModalItem.uom}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIssueModalItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={issuingSubmit}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
                >
                  {issuingSubmit ? 'Issuing...' : 'Confirm Issue to Production'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* EDITABLE PURCHASE INDENT & SAFETY STOCK PREVIEW MODAL        */}
      {/* ============================================================ */}
      <EditPrIndentModal
        isOpen={indentEditModalOpen}
        onClose={() => setIndentEditModalOpen(false)}
        items={indentEditItems}
        onConfirmPrint={handleConfirmIndentPrint}
        isSubmitting={indentSubmitting}
      />

      {/* ============================================================ */}
      {/* PRINTABLE VELAN METROLOGY PURCHASE REQUISITION SLIP MODAL   */}
      {/* ============================================================ */}
      {printModalData && (
        <VelanPrPrintModal
          isOpen={printModalOpen}
          onClose={() => setPrintModalOpen(false)}
          prNumber={printModalData.prNumber}
          date={printModalData.date}
          paymentMode={printModalData.paymentMode}
          items={printModalData.items}
          onPrintConfirmed={() => {
            setPrintModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* ============================================================ */}
      {/* CONSUMABLE SLA & NOTIFICATION ALERTS SETTINGS MODAL          */}
      {/* ============================================================ */}
      <ConsumableAlertSettingsModal
        isOpen={alertSettingsModalOpen}
        onClose={() => setAlertSettingsModalOpen(false)}
        onSaved={loadData}
      />
    </div>
  );
}

export default ConsumablePurchaseStoreWorkspace;
