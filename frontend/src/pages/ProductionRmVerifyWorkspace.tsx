import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Search, 
  Box, 
  FileText, 
  Filter, 
  CheckCheck, 
  RefreshCw,
  Building2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService, type MaterialIssue, type SC } from '../services/workflowService';
import toast from 'react-hot-toast';

interface EnrichedIssueItem {
  id: string;
  rmItemId: string;
  rmItem?: {
    id: string;
    material: string;
    grade?: string;
    size?: string;
    partNumber?: string;
    partName?: string;
    weightUnit?: string;
  };
  quantityIssued: number;
  previouslyReceived: number;
  pendingQuantity: number;
  receiveInputQty: number;
  binCode?: string;
  rackCode?: string;
}

interface EnrichedMaterialIssue {
  id: string;
  scId: string;
  issueNumber: string;
  issueType: string;
  remarks?: string;
  createdAt: string;
  salesOrderComponent?: SC & {
    purchaseOrder?: {
      id?: string;
      poNumber?: string;
    };
  };
  items: EnrichedIssueItem[];
  totalIssued: number;
  totalReceived: number;
  totalPending: number;
  status: 'PENDING' | 'PARTIAL' | 'COMPLETED';
}

interface GroupedPo {
  poNumber: string;
  poId?: string;
  issues: EnrichedMaterialIssue[];
  totalIssues: number;
  pendingIssuesCount: number;
  totalPendingQty: number;
}

export function ProductionRmVerifyWorkspace() {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [viewMode, setViewMode] = useState<'PO_GROUPED' | 'LIST'>('PO_GROUPED');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [rawIssues, setRawIssues] = useState<MaterialIssue[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  
  // Selection & Form State
  const [expandedPos, setExpandedPos] = useState<Record<string, boolean>>({});
  const hasAutoExpandedRef = useRef(false);
  const [receiveInputs, setReceiveInputs] = useState<Record<string, Record<string, number>>>({});
  const [receiptRemarks] = useState<Record<string, string>>({});
  const [receivingId, setReceivingId] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPoFilter, setSelectedPoFilter] = useState('ALL');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [issueData, receiptData] = await Promise.all([
        workflowService.getIssueList(),
        workflowService.getReceipts(),
      ]);

      setRawIssues(issueData || []);
      setReceipts(receiptData || []);
    } catch (err: any) {
      console.error('Failed to load material issues and receipts', err);
      toast.error('Failed to load issues and receipts from server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Process & enrich issues with accurate receipt calculation
  const enrichedIssues: EnrichedMaterialIssue[] = useMemo(() => {
    return rawIssues.map((issue) => {
      // Find all receipts matching this material issue
      const matchingReceipts = receipts.filter(
        (r) => (r.materialIssueId || r.materialIssue?.id) === issue.id
      );

      let totalIssued = 0;
      let totalReceived = 0;
      let totalPending = 0;

      const items: EnrichedIssueItem[] = (issue.items || []).map((it: any) => {
        const issuedQty = Number(it.quantityIssued) || 0;
        totalIssued += issuedQty;

        // Sum received for this rmItemId across all receipts
        const itemId = it.rmItemId || it.rmItem?.id || it.id;
        const prevReceived = matchingReceipts.reduce((sum, rec) => {
          const recItems = rec.items || [];
          const matchedRecItem = recItems.find(
            (ri: any) => (ri.rmItemId || ri.rmItem?.id) === itemId
          );
          return sum + (matchedRecItem ? Number(matchedRecItem.quantityReceived) || 0 : 0);
        }, 0);

        totalReceived += prevReceived;
        const pending = Math.max(0, issuedQty - prevReceived);
        totalPending += pending;

        return {
          id: it.id,
          rmItemId: itemId,
          rmItem: it.rmItem,
          quantityIssued: issuedQty,
          previouslyReceived: prevReceived,
          pendingQuantity: pending,
          receiveInputQty: pending,
          binCode: it.binCode || it.bin?.code,
          rackCode: it.rackCode || it.rack?.code,
        };
      });

      let status: 'PENDING' | 'PARTIAL' | 'COMPLETED' = 'PENDING';
      if (totalPending <= 0) {
        status = 'COMPLETED';
      } else if (totalReceived > 0) {
        status = 'PARTIAL';
      }

      return {
        id: issue.id,
        scId: issue.scId,
        issueNumber: issue.issueNumber,
        issueType: issue.issueType,
        remarks: issue.remarks,
        createdAt: issue.createdAt,
        salesOrderComponent: issue.salesOrderComponent,
        items,
        totalIssued,
        totalReceived,
        totalPending,
        status,
      };
    });
  }, [rawIssues, receipts]);

  // Pending issues awaiting receipt
  const pendingIssues = useMemo(() => {
    return enrichedIssues.filter((iss) => iss.totalPending > 0);
  }, [enrichedIssues]);

  // Distinct PO list for dropdown filter
  const distinctPos = useMemo(() => {
    const poSet = new Set<string>();
    pendingIssues.forEach((iss) => {
      const poNum = iss.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct Orders (No PO)';
      poSet.add(poNum);
    });
    return Array.from(poSet);
  }, [pendingIssues]);

  // Grouped by Purchase Order (PO)
  const groupedByPo: GroupedPo[] = useMemo(() => {
    const map = new Map<string, EnrichedMaterialIssue[]>();
    
    pendingIssues.forEach((iss) => {
      const poNum = iss.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct Orders (No PO)';
      if (!map.has(poNum)) {
        map.set(poNum, []);
      }
      map.get(poNum)!.push(iss);
    });

    const result: GroupedPo[] = [];
    map.forEach((issuesList, poNum) => {
      let pendingQty = 0;
      issuesList.forEach((i) => {
        pendingQty += i.totalPending;
      });

      result.push({
        poNumber: poNum,
        poId: issuesList[0]?.salesOrderComponent?.purchaseOrder?.id,
        issues: issuesList,
        totalIssues: issuesList.length,
        pendingIssuesCount: issuesList.length,
        totalPendingQty: pendingQty,
      });
    });

    // Sort POs alphabetically
    return result.sort((a, b) => a.poNumber.localeCompare(b.poNumber));
  }, [pendingIssues]);

  // Automatically expand first PO on initial data load
  useEffect(() => {
    if (groupedByPo.length > 0 && !hasAutoExpandedRef.current) {
      hasAutoExpandedRef.current = true;
      setExpandedPos({ [groupedByPo[0].poNumber]: true });
    }
  }, [groupedByPo]);

  // Toggle PO expansion without resetting on collapse
  const togglePoExpanded = (poNumber: string) => {
    setExpandedPos((prev) => {
      const isCurrentlyExpanded = prev[poNumber] !== undefined ? prev[poNumber] : (groupedByPo[0]?.poNumber === poNumber);
      return {
        ...prev,
        [poNumber]: !isCurrentlyExpanded,
      };
    });
  };

  const expandAllPos = () => {
    const all: Record<string, boolean> = {};
    groupedByPo.forEach((p) => {
      all[p.poNumber] = true;
    });
    setExpandedPos(all);
  };

  const collapseAllPos = () => {
    const all: Record<string, boolean> = {};
    groupedByPo.forEach((p) => {
      all[p.poNumber] = false;
    });
    setExpandedPos(all);
  };

  // Filtered issues based on search & PO selection
  const filteredPendingIssues = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return pendingIssues.filter((iss) => {
      const poNum = (iss.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct Orders (No PO)').toLowerCase();
      const scNum = (iss.salesOrderComponent?.scNumber || '').toLowerCase();
      const prodName = (iss.salesOrderComponent?.productName || '').toLowerCase();
      const issNum = iss.issueNumber.toLowerCase();

      const matchesSearch = !q || poNum.includes(q) || scNum.includes(q) || prodName.includes(q) || issNum.includes(q) ||
        iss.items.some((it) => (it.rmItem?.material || '').toLowerCase().includes(q) || (it.rmItem?.partNumber || '').toLowerCase().includes(q));

      const matchesPo = selectedPoFilter === 'ALL' || (iss.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct Orders (No PO)') === selectedPoFilter;

      return matchesSearch && matchesPo;
    });
  }, [pendingIssues, searchTerm, selectedPoFilter]);

  // Filtered Grouped POs
  const filteredGroupedPos = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return groupedByPo.filter((po) => {
      const matchesPoFilter = selectedPoFilter === 'ALL' || po.poNumber === selectedPoFilter;
      const matchesSearch = !q || po.poNumber.toLowerCase().includes(q) ||
        po.issues.some((iss) => 
          (iss.salesOrderComponent?.scNumber || '').toLowerCase().includes(q) ||
          (iss.salesOrderComponent?.productName || '').toLowerCase().includes(q) ||
          iss.issueNumber.toLowerCase().includes(q) ||
          iss.items.some((it) => (it.rmItem?.material || '').toLowerCase().includes(q))
        );
      return matchesPoFilter && matchesSearch;
    });
  }, [groupedByPo, searchTerm, selectedPoFilter]);

  // Filtered Receipts Ledger
  const filteredReceipts = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return receipts.filter((rec) => {
      if (!q) return true;
      const scNum = (rec.materialIssue?.salesOrderComponent?.scNumber || rec.salesOrderComponent?.scNumber || rec.scNumber || '').toLowerCase();
      const poNum = (rec.materialIssue?.salesOrderComponent?.purchaseOrder?.poNumber || '').toLowerCase();
      const recNum = (rec.receiptNumber || rec.id || '').toLowerCase();
      const prodName = (rec.materialIssue?.salesOrderComponent?.productName || '').toLowerCase();
      const receivedBy = (rec.receivedBy?.name || rec.receivedBy?.email || '').toLowerCase();
      return scNum.includes(q) || poNum.includes(q) || recNum.includes(q) || prodName.includes(q) || receivedBy.includes(q);
    });
  }, [receipts, searchTerm]);

  // Handle changing input quantity for a specific item
  const handleItemQtyChange = (issueId: string, rmItemId: string, val: number, maxPending: number) => {
    const cleanVal = isNaN(val) ? 0 : Math.min(Math.max(0, val), maxPending);
    setReceiveInputs((prev) => ({
      ...prev,
      [issueId]: {
        ...(prev[issueId] || {}),
        [rmItemId]: cleanVal,
      },
    }));
  };

  // Confirm Received action
  const handleConfirmReceived = async (issue: EnrichedMaterialIssue) => {
    setReceivingId(issue.id);
    try {
      const itemInputs = receiveInputs[issue.id] || {};
      
      // Build payload items
      const itemsToReceive = issue.items
        .map((it) => {
          const inputQty = itemInputs[it.rmItemId] !== undefined ? itemInputs[it.rmItemId] : it.pendingQuantity;
          return {
            rmItemId: it.rmItemId,
            quantityReceived: Number(inputQty),
          };
        })
        .filter((it) => it.quantityReceived > 0);

      if (itemsToReceive.length === 0) {
        toast.error('Please enter at least one item quantity greater than 0 to receive.');
        return;
      }

      const remarks = receiptRemarks[issue.id] || 'Shop floor receipt confirmed against PO/SC';

      await workflowService.receiveMaterial(
        issue.id,
        issue.scId,
        itemsToReceive,
        remarks
      );

      const poRef = issue.salesOrderComponent?.purchaseOrder?.poNumber ? ` [PO: ${issue.salesOrderComponent.purchaseOrder.poNumber}]` : '';
      toast.success(`Material successfully received for SC: ${issue.salesOrderComponent?.scNumber || issue.scId}${poRef}!`);
      
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to confirm receipt');
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Material Receipt (PO / SC)"
        subtitle="Stores & Production fulfillment: Inspect materials issued against Purchase Orders & Subcontracting Components, verify physical items, and confirm shop-floor receipt."
        actionSlot={
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'PENDING'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Pending Receipt ({pendingIssues.length})
              </button>
              <button
                onClick={() => setActiveTab('HISTORY')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Receipt Ledger ({receipts.length})
              </button>
            </div>
          </div>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Orders</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {pendingIssues.length}
          </p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            Waiting for shop-floor receipt
          </span>
        </div>

        <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active POs</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {distinctPos.length}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">
            POs with material dispatched
          </span>
        </div>

        <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items to Receive</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Box className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {pendingIssues.reduce((sum, i) => sum + i.items.filter((it) => it.pendingQuantity > 0).length, 0)}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">
            Raw material lots pending
          </span>
        </div>

        <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Confirmed Receipts</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
            {receipts.length}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Logged in custody ledger
          </span>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search PO #, SC #, Part #, or Product..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
            />
          </div>

          {activeTab === 'PENDING' && (
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              <select
                value={selectedPoFilter}
                onChange={(e) => setSelectedPoFilter(e.target.value)}
                className="text-xs py-1.5 px-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Purchase Orders ({distinctPos.length})</option>
                {distinctPos.map((po) => (
                  <option key={po} value={po}>
                    PO: {po}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {activeTab === 'PENDING' && (
          <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
            {viewMode === 'PO_GROUPED' && filteredGroupedPos.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs mr-1">
                <button
                  type="button"
                  onClick={expandAllPos}
                  className="px-2 py-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors cursor-pointer"
                  title="Expand all purchase order cards"
                >
                  Expand All
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={collapseAllPos}
                  className="px-2 py-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold transition-colors cursor-pointer"
                  title="Collapse all purchase order cards"
                >
                  Collapse All
                </button>
              </div>
            )}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('PO_GROUPED')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'PO_GROUPED'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Grouped by PO
              </button>
              <button
                onClick={() => setViewMode('LIST')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'LIST'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Work Orders
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
          <p className="text-xs font-semibold text-slate-500">Loading material issues & PO specifications...</p>
        </div>
      ) : activeTab === 'PENDING' ? (
        filteredPendingIssues.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">All Dispatched Materials Received</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no raw material issue lots waiting for shop-floor receipt confirmation. New issues from Stores will automatically appear here.
            </p>
          </div>
        ) : viewMode === 'PO_GROUPED' ? (
          /* ============================================================ */
          /* PO GROUPED VIEW: Users click a PO to see items & click "Received" */
          /* ============================================================ */
          <div className="space-y-4">
            {filteredGroupedPos.map((poGroup) => {
              const isPoExpanded = Boolean(expandedPos[poGroup.poNumber]);

              return (
                <div
                  key={poGroup.poNumber}
                  className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden transition-all"
                >
                  {/* PO Accordion Header */}
                  <div
                    onClick={() => togglePoExpanded(poGroup.poNumber)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isPoExpanded}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePoExpanded(poGroup.poNumber);
                      }
                    }}
                    className="p-4 md:p-5 bg-slate-50/70 dark:bg-slate-900/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 cursor-pointer flex items-center justify-between border-b border-slate-200 dark:border-slate-800 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            PO: {poGroup.poNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                            {poGroup.pendingIssuesCount} Work Order(s) Awaiting Receipt
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Click to view Subcontracting Components and material breakdown for this Purchase Order
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                          {poGroup.totalPendingQty} Units Pending
                        </span>
                        <p className="text-[10px] text-slate-400">Across {poGroup.totalIssues} dispatch lot(s)</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePoExpanded(poGroup.poNumber);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
                        title={isPoExpanded ? 'Collapse Purchase Order' : 'Expand Purchase Order'}
                        aria-label={isPoExpanded ? 'Collapse Purchase Order' : 'Expand Purchase Order'}
                      >
                        {isPoExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* PO Details Body (Work Orders & Items) */}
                  {isPoExpanded && (
                    <div className="p-4 md:p-6 space-y-6">
                      {poGroup.issues.map((issue) => {
                        const scNum = issue.salesOrderComponent?.scNumber || issue.scId;
                        const prodName = issue.salesOrderComponent?.productName || 'Assembly';
                        const isReceiving = receivingId === issue.id;
                        const itemInputs = receiveInputs[issue.id] || {};

                        return (
                          <div
                            key={issue.id}
                            className="border border-slate-200 dark:border-slate-700/80 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/20"
                          >
                            {/* SC Sub-Header */}
                            <div className="p-4 bg-white dark:bg-[#141829] border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 text-xs font-extrabold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-md">
                                    SC: {scNum}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                                    {prodName}
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-700">•</span>
                                  <span className="text-xs font-semibold text-slate-500">
                                    Issue #{issue.issueNumber}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" />
                                  Issued on {new Date(issue.createdAt).toLocaleString()}
                                  {issue.remarks && <span className="italic text-slate-500">• "{issue.remarks}"</span>}
                                </p>
                              </div>

                              {/* Prominent "Received" Button */}
                              <button
                                onClick={() => handleConfirmReceived(issue)}
                                disabled={isReceiving}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50 cursor-pointer self-start md:self-auto"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{isReceiving ? 'Confirming...' : 'Received'}</span>
                              </button>
                            </div>

                            {/* Itemized Materials Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100/60 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                                  <tr>
                                    <th className="px-4 py-2.5">Part # / Material</th>
                                    <th className="px-4 py-2.5">Specification / Size</th>
                                    <th className="px-4 py-2.5 text-right">Issued Qty</th>
                                    <th className="px-4 py-2.5 text-right">Previously Received</th>
                                    <th className="px-4 py-2.5 text-right">Remaining to Receive</th>
                                    <th className="px-4 py-2.5 text-right w-40">Qty Receiving Now</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#141829]">
                                  {issue.items.map((it) => {
                                    const partCode = it.rmItem?.partNumber || it.rmItem?.partName || 'Part';
                                    const currentInput = itemInputs[it.rmItemId] !== undefined ? itemInputs[it.rmItemId] : it.pendingQuantity;

                                    return (
                                      <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="px-4 py-3">
                                          <div className="font-bold text-slate-900 dark:text-white">
                                            {it.rmItem?.material || 'Raw Material'}
                                          </div>
                                          <div className="text-[10px] text-slate-400 font-mono">
                                            {partCode}
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                                          {[it.rmItem?.grade, it.rmItem?.size].filter(Boolean).join(' • ') || 'Standard Specification'}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                                          {it.quantityIssued} {it.rmItem?.weightUnit || ''}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-slate-500 tabular-nums">
                                          {it.previouslyReceived}
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                          {it.pendingQuantity}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <input
                                            type="number"
                                            min={0}
                                            max={it.pendingQuantity}
                                            step="any"
                                            value={currentInput}
                                            onChange={(e) =>
                                              handleItemQtyChange(
                                                issue.id,
                                                it.rmItemId,
                                                parseFloat(e.target.value),
                                                it.pendingQuantity
                                              )
                                            }
                                            className="w-28 text-right px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ============================================================ */
          /* FLAT WORK ORDERS VIEW: Direct list of all pending issues */
          /* ============================================================ */
          <div className="space-y-4">
            {filteredPendingIssues.map((issue) => {
              const scNum = issue.salesOrderComponent?.scNumber || 'N/A';
              const poNum = issue.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct Order';
              const prodName = issue.salesOrderComponent?.productName || 'Assembly';
              const isReceiving = receivingId === issue.id;
              const itemInputs = receiveInputs[issue.id] || {};

              return (
                <div
                  key={issue.id}
                  className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden hover:border-indigo-300 dark:hover:border-indigo-600/50 transition-all"
                >
                  <div className="p-4 md:p-5 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-md">
                          PO: {poNum}
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          SC: {scNum}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          {prodName}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 font-semibold">
                          Issue #{issue.issueNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Dispatched from Stores on {new Date(issue.createdAt).toLocaleString()}
                        {issue.remarks && <span className="italic text-slate-600 dark:text-slate-300">• "{issue.remarks}"</span>}
                      </p>
                    </div>

                    <button
                      onClick={() => handleConfirmReceived(issue)}
                      disabled={isReceiving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isReceiving ? 'Confirming...' : 'Received'}</span>
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="p-4 md:p-5 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="pb-2">Material / Part</th>
                          <th className="pb-2">Grade / Size</th>
                          <th className="pb-2 text-right">Qty Issued</th>
                          <th className="pb-2 text-right">Already Received</th>
                          <th className="pb-2 text-right">Pending</th>
                          <th className="pb-2 text-right w-36">Qty Receiving</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {issue.items.map((it) => {
                          const currentInput = itemInputs[it.rmItemId] !== undefined ? itemInputs[it.rmItemId] : it.pendingQuantity;

                          return (
                            <tr key={it.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                              <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                                {it.rmItem?.material || 'Raw Material'}
                                {it.rmItem?.partNumber && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {it.rmItem.partNumber}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 text-slate-600 dark:text-slate-400">
                                {[it.rmItem?.grade, it.rmItem?.size].filter(Boolean).join(' • ') || 'Standard Specification'}
                              </td>
                              <td className="py-2.5 text-right font-medium text-slate-700 dark:text-slate-300 tabular-nums">
                                {it.quantityIssued}
                              </td>
                              <td className="py-2.5 text-right font-medium text-slate-500 tabular-nums">
                                {it.previouslyReceived}
                              </td>
                              <td className="py-2.5 text-right font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                {it.pendingQuantity}
                              </td>
                              <td className="py-2.5 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  max={it.pendingQuantity}
                                  step="any"
                                  value={currentInput}
                                  onChange={(e) =>
                                    handleItemQtyChange(
                                      issue.id,
                                      it.rmItemId,
                                      parseFloat(e.target.value),
                                      it.pendingQuantity
                                    )
                                  }
                                  className="w-24 text-right px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ============================================================ */
        /* RECEIPT LEDGER / AUDIT HISTORY TAB */
        /* ============================================================ */
        <div className="bg-white dark:bg-[#141829] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Confirmed Material Receipt Ledger
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Total {filteredReceipts.length} logged receipt(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">Receipt #</th>
                  <th className="px-5 py-3">PO Reference</th>
                  <th className="px-5 py-3">SC / Product</th>
                  <th className="px-5 py-3">Received At</th>
                  <th className="px-5 py-3">Received By</th>
                  <th className="px-5 py-3">Items Received</th>
                  <th className="px-5 py-3 text-right">Receipt Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      No receipt records match your query.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((rec) => {
                    const poNum =
                      rec.materialIssue?.salesOrderComponent?.purchaseOrder?.poNumber ||
                      rec.purchaseOrder?.poNumber ||
                      'Direct Order';
                    const scNum =
                      rec.materialIssue?.salesOrderComponent?.scNumber ||
                      rec.salesOrderComponent?.scNumber ||
                      rec.scNumber ||
                      'N/A';
                    const prodName =
                      rec.materialIssue?.salesOrderComponent?.productName ||
                      rec.salesOrderComponent?.productName ||
                      '';
                    const recNum = rec.receiptNumber || `REC-${rec.id.slice(0, 8)}`;

                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-5 py-3.5 font-bold text-slate-900 dark:text-white font-mono">
                          {recNum}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">
                          {poNum}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-slate-900 dark:text-white">{scNum}</div>
                          {prodName && <div className="text-[10px] text-slate-400">{prodName}</div>}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 text-[11px]">
                          {new Date(rec.receivedAt || rec.createdAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {rec.receivedBy?.name || rec.receivedBy?.email || 'Shop Floor Operator'}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-400">
                          {(rec.items || []).map((it: any) => `${it.rmItem?.material || 'Material'}: ${it.quantityReceived}`).join(', ') || 'Receipt recorded'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="px-2.5 py-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{rec.status || 'RECEIVED'}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
