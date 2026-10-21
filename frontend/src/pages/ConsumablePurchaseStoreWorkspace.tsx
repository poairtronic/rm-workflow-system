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
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { VelanPrPrintModal } from '../components/consumables/VelanPrPrintModal';
import { consumablesApi, type BinOption } from '../services/consumables.service';
import type { ConsumableLineItemRecord } from '../types/consumables.types';
import toast from 'react-hot-toast';

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
  const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'ALL' | 'OPEN' | 'PURCHASE_REQUESTED' | 'PURCHASE_RECEIVED'>('ALL');

  // Selection for Batch PR Print
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  // --- PRINT SINGLE LINE ITEM ONLY ---
  const handlePrintSingleItem = async (item: ConsumableLineItemRecord) => {
    if (item.prNumber) {
      // Already has a PR assigned -> Open modal with ONLY THIS SINGLE ITEM
      setPrintModalData({
        prNumber: item.prNumber,
        items: [item],
        date: item.printedAt ? new Date(item.printedAt).toISOString() : new Date().toISOString(),
        paymentMode: 'CASH',
      });
      setPrintModalOpen(true);
      return;
    }

    // If item is OPEN and needs PR generation
    try {
      const res = await consumablesApi.printPurchaseRequisition([item.id]);
      const printedItem = res.items && res.items.length > 0 ? res.items[0] : item;
      setPrintModalData({
        prNumber: res.prNumber || item.prNumber || '151',
        items: [printedItem], // Strictly ONLY this single item
        date: new Date().toISOString(),
        paymentMode: 'CASH',
      });
      setPrintModalOpen(true);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate Purchase Requisition');
    }
  };

  // --- TRIGGER BATCH PR PRINT FOR SELECTED ITEMS ---
  const handlePrintSelectedPr = async () => {
    const targetItems = allItems.filter((i) => selectedIds.includes(i.id));
    if (targetItems.length === 0) {
      toast.error('Please select at least one line item to print.');
      return;
    }

    // Check if any selected items are OPEN or need PR number assignment
    const itemsNeedingPr = targetItems.filter((i) => !i.prNumber || i.status === 'OPEN');

    if (itemsNeedingPr.length > 0) {
      try {
        const ids = targetItems.map((i) => i.id);
        const res = await consumablesApi.printPurchaseRequisition(ids);

        setPrintModalData({
          prNumber: res.prNumber || '151',
          items: res.items && res.items.length > 0 ? res.items : targetItems,
          date: new Date().toISOString(),
          paymentMode: 'CASH',
        });
        setPrintModalOpen(true);
        setSelectedIds([]);
        await loadData();
      } catch (err: any) {
        toast.error(err?.message || 'Failed to generate Purchase Requisition');
      }
    } else {
      // All selected items already have PR numbers assigned
      // Group them all together onto the printed PR sheet
      const prNumber = targetItems[0].prNumber || '151';
      setPrintModalData({
        prNumber,
        items: targetItems, // ALL selected items appear here
        date: targetItems[0]?.printedAt ? new Date(targetItems[0].printedAt).toISOString() : new Date().toISOString(),
        paymentMode: 'CASH',
      });
      setPrintModalOpen(true);
    }
  };

  // --- RECEIVE PURCHASE SUBMISSION ---
  const handleOpenReceiveModal = async (item: ConsumableLineItemRecord) => {
    setReceiveModalItem(item);
    const req = Number(item.requestedQty) || 0;
    const rec = Number(item.realReceivedQty) || 0;
    // Quantity physically received from vendor (e.g. 500, 80, 70)
    setRealReceivedQty(rec > 0 ? rec : (req > 0 ? req : 1));
    // Quantity to immediately deliver to production (defaults to requested quantity, e.g. 5)
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
    const rec = Number(item.realReceivedQty) || 0;
    const defaultQty = rec > 0 ? rec : (req > 0 ? req : 1);
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
        item.itemCategoryTrack === 'STOCK_ITEM' || item.status === 'PURCHASE_RECEIVED' || item.status === 'READY_FOR_ISSUE';
      if (!isStockTrack) return false;

      const matchesSearch =
        !searchQuery.trim() ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requestCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.endUserInVelan?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [allItems, searchQuery]);

  // Sub-Module 2B: Non-Stock / Purchase Queue
  const purchaseQueueItems = useMemo(() => {
    return allItems.filter((item) => {
      const isPurchaseTrack = item.itemCategoryTrack === 'NON_STOCK_OR_NEW';
      if (!isPurchaseTrack) return false;

      // Status filter
      if (purchaseStatusFilter !== 'ALL' && item.status !== purchaseStatusFilter) {
        return false;
      }

      const matchesSearch =
        !searchQuery.trim() ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requestCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.prNumber && item.prNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.endUserInVelan?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [allItems, purchaseStatusFilter, searchQuery]);

  // Key KPI Metrics
  const readyForIssueCount = useMemo(
    () => allItems.filter((i) => i.status === 'READY_FOR_ISSUE' || i.status === 'PURCHASE_RECEIVED').length,
    [allItems]
  );
  const openPrCount = useMemo(
    () => allItems.filter((i) => i.itemCategoryTrack === 'NON_STOCK_OR_NEW' && i.status === 'OPEN').length,
    [allItems]
  );
  const prPrintedCount = useMemo(
    () => allItems.filter((i) => i.status === 'PURCHASE_REQUESTED').length,
    [allItems]
  );
  const issuedToProdCount = useMemo(
    () => allItems.filter((i) => i.status === 'ISSUED_TO_PRODUCTION').length,
    [allItems]
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Consumable Purchase & Store Fulfillment"
        subtitle="Module 2: In-stock store issuance, Velan Metrology PR slip printing, real quantity stock-in, and shop-floor dispatch"
        actionSlot={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === 'STOCK_QUEUE' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('STOCK_QUEUE')}
              className="flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4" />
              Tab 1: In-Stock Items ({readyForIssueCount})
            </Button>
            <Button
              variant={activeTab === 'PURCHASE_QUEUE' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('PURCHASE_QUEUE')}
              className="flex items-center gap-1.5"
            >
              <Building2 className="w-4 h-4" />
              Tab 2: Purchase Queue ({openPrCount + prPrintedCount})
            </Button>
          </div>
        }
      />

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Ready for Issue</span>
            <Boxes className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{readyForIssueCount}</p>
          <span className="text-[11px] text-slate-400">In-stock & inwarded items</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Unprinted PRs</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{openPrCount}</p>
          <span className="text-[11px] text-slate-400">Select & print Velan PR slip</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Awaiting Inward</span>
            <PackagePlus className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{prPrintedCount}</p>
          <span className="text-[11px] text-slate-400">PR printed, pending delivery</span>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Issued to Floor</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{issuedToProdCount}</p>
          <span className="text-[11px] text-slate-400">Awaiting production receipt</span>
        </Card>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: IN-STOCK LINE ITEMS QUEUE (STORE ISSUANCE)           */}
      {/* ============================================================ */}
      {activeTab === 'STOCK_QUEUE' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-purple-500" />
                In-Stock Consumables Queue (Ready for Issue)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Line items with stock available in warehouse bins. Issue directly to Production to execute atomic STOCK_OUT.
              </p>
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3">Request #</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3">End User / Bay</th>
                  <th className="py-3 px-3">Requested By</th>
                  <th className="py-3 px-3 font-mono text-right">Avail. Stock</th>
                  <th className="py-3 px-3 font-mono text-right">Req. Qty</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading in-stock queue...
                    </td>
                  </tr>
                ) : inStockItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No in-stock items currently pending issuance.
                    </td>
                  </tr>
                ) : (
                  inStockItems.map((item) => {
                    const isIssued = item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.requestCode}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {item.description}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.productCode || 'CONS'} • {item.uom}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                          {item.endUserInVelan || 'Plant General'}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                          {item.requestedBy}
                        </td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-purple-600 dark:text-purple-400">
                          {Number(item.stockAvailableAtRequest || 0)} {item.uom}
                        </td>
                        <td className="py-3 px-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                          {Number(item.requestedQty || 0)} {item.uom}
                        </td>
                        <td className="py-3 px-3">
                          {item.status === 'READY_FOR_ISSUE' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-500/20">
                              Ready for Issue
                            </span>
                          )}
                          {item.status === 'PURCHASE_RECEIVED' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-500/20">
                              Inwarded in Bin
                            </span>
                          )}
                          {isIssued && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/20">
                              Issued ({item.issuedQty} {item.uom})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {!isIssued ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenIssueModal(item)}
                              disabled={actionLoadingId === item.id}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs mx-auto cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Issue to Production
                            </Button>
                          ) : (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              Dispatched
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

      {/* ============================================================ */}
      {/* TAB 2: NON-STOCK & NEW PRODUCTS (PURCHASE REQUISITIONS)     */}
      {/* ============================================================ */}
      {activeTab === 'PURCHASE_QUEUE' && (
        <Card className="p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Purchase Queue: Out-of-Stock & New Products
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select OPEN items to print official Velan Metrology Purchase Requisitions (starting at #151). Inward stock upon delivery.
              </p>
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
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Sub-Filters & Search */}
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

            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('ALL')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  purchaseStatusFilter === 'ALL'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Purchase Items
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('OPEN')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  purchaseStatusFilter === 'OPEN'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Open / Unprinted ({openPrCount})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('PURCHASE_REQUESTED')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  purchaseStatusFilter === 'PURCHASE_REQUESTED'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                PR Printed ({prPrintedCount})
              </button>
              <button
                type="button"
                onClick={() => setPurchaseStatusFilter('PURCHASE_RECEIVED')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                  purchaseStatusFilter === 'PURCHASE_RECEIVED'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Inwarded
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={
                        purchaseQueueItems.length > 0 &&
                        purchaseQueueItems.every((i) => selectedIds.includes(i.id))
                      }
                      onChange={(e) => handleSelectAllVisible(e.target.checked)}
                      className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      title="Select all items in purchase queue"
                    />
                  </th>
                  <th className="py-3 px-3">PR # / Req #</th>
                  <th className="py-3 px-3">Item Description</th>
                  <th className="py-3 px-3">Supplier / Vendor</th>
                  <th className="py-3 px-3 font-mono text-right">Req. Qty</th>
                  <th className="py-3 px-3 font-mono text-right">Real Inward Qty</th>
                  <th className="py-3 px-3">Current Stage</th>
                  <th className="py-3 px-3 text-center">Procurement Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-indigo-500" />
                      Loading purchase queue...
                    </td>
                  </tr>
                ) : purchaseQueueItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No purchase queue items match your filter.
                    </td>
                  </tr>
                ) : (
                  purchaseQueueItems.map((item) => {
                    const isOpen = item.status === 'OPEN';
                    const isRequested = item.status === 'PURCHASE_REQUESTED';
                    const isReceived = item.status === 'PURCHASE_RECEIVED';
                    const isIssued = item.status === 'ISSUED_TO_PRODUCTION' || item.status === 'RECEIVED_BY_PRODUCTION';

                    return (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          selectedIds.includes(item.id)
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/20'
                            : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => handleToggleSelect(item.id)}
                            className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title="Select line item for PR print"
                          />
                        </td>

                        {/* PR # / Req # */}
                        <td className="py-3 px-3 font-mono font-semibold text-slate-900 dark:text-white">
                          {item.prNumber ? (
                            <button
                              type="button"
                              onClick={() => handlePrintSingleItem(item)}
                              className="px-2 py-0.5 rounded-sm bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 font-bold block w-fit mb-0.5 cursor-pointer flex items-center gap-1 transition-colors"
                              title="Click to view & print official Velan Purchase Requisition slip for this item"
                            >
                              <Printer className="w-3 h-3" />
                              PR. No. {item.prNumber}
                            </button>
                          ) : (
                            <span className="text-slate-400 italic">No PR assigned</span>
                          )}
                          <span className="text-[10px] text-slate-500 block">{item.requestCode}</span>
                        </td>

                        {/* Description */}
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-900 dark:text-white block">
                            {item.description}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {item.uom} {item.isNewProduct ? '• (+ Auto Created Product)' : ''}
                          </span>
                        </td>

                        {/* Vendor Context */}
                        <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                          {item.isNewVendor ? (
                            <div>
                              <span className="font-bold text-amber-700 dark:text-amber-400 block">
                                {item.newVendorName || 'New Vendor'}
                              </span>
                              <span className="text-[10px] text-slate-400 block font-mono">
                                {item.newVendorMobile || item.newVendorAddress || ''}
                              </span>
                            </div>
                          ) : item.vendorName ? (
                            <span className="font-medium text-slate-900 dark:text-white">
                              {item.vendorName}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Open Sourcing</span>
                          )}
                        </td>

                        {/* Req Qty */}
                        <td className="py-3 px-3 font-mono text-right font-semibold text-slate-700 dark:text-slate-300">
                          {Number(item.requestedQty || 0)} {item.uom}
                        </td>

                        {/* Real Received Qty & Retained Stores Stock */}
                        <td className="py-3 px-3 font-mono text-right font-bold text-slate-900 dark:text-white">
                          {Number(item.realReceivedQty || 0) > 0 ? (
                            <div>
                              <span className="text-emerald-600 dark:text-emerald-400 block font-bold">
                                {item.realReceivedQty} {item.uom}
                              </span>
                              {Number(item.issuedQty) > 0 && Number(item.realReceivedQty) > Number(item.issuedQty) && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 block font-normal">
                                  ({item.issuedQty} issued / {Number(item.realReceivedQty) - Number(item.issuedQty)} in stock)
                                </span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          {isOpen && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-500/20">
                              Open (Unprinted)
                            </span>
                          )}
                          {isRequested && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-500/20">
                              PR Printed ({item.prNumber})
                            </span>
                          )}
                          {isReceived && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-500/20">
                              Received in Store
                            </span>
                          )}
                          {isIssued && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-500/20">
                              Issued to Production
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Step 1: Print PR (if OPEN) */}
                            {isOpen && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handlePrintSingleItem(item)}
                                className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Printer className="w-3 h-3" />
                                Print PR Slip
                              </Button>
                            )}

                            {/* View / Re-print PR Slip (if already assigned PR) */}
                            {item.prNumber && !isOpen && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handlePrintSingleItem(item)}
                                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer border border-indigo-200 dark:border-indigo-800"
                                title="View or re-print official Velan PR slip for this item"
                              >
                                <Printer className="w-3 h-3" />
                                Print PR Slip
                              </Button>
                            )}

                            {/* Step 2: Receive Purchase */}
                            {isRequested && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenReceiveModal(item)}
                                className="bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <PackagePlus className="w-3.5 h-3.5" />
                                Mark Received
                              </Button>
                            )}

                            {/* Step 3: Issue to Production if not auto-issued */}
                            {isReceived && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenIssueModal(item)}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                Issue to Floor
                              </Button>
                            )}

                            {isIssued && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                Dispatched
                              </span>
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
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span>Req. Qty: <b>{receiveModalItem.requestedQty} {receiveModalItem.uom}</b></span>
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
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span>Req. Qty: <b>{issueModalItem.requestedQty} {issueModalItem.uom}</b></span>
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
                  Quantity to Issue *
                </label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step="any"
                  value={issueQty}
                  onChange={(e) => setIssueQty(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-base font-mono font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
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
    </div>
  );
}

export default ConsumablePurchaseStoreWorkspace;
