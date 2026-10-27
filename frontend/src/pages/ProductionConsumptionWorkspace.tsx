import { useState, useEffect } from 'react';
import { 
  PlaySquare, 
  AlertCircle, 
  Plus, 
  FileText, 
  Printer, 
  Search, 
  Boxes,
  RefreshCw,
  Clock,
  Package,
  RotateCcw,
  Layers,
  Calendar
} from 'lucide-react';
import { workflowService, type SC, type MaterialAccounting } from '../services/workflowService';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/ui/StatusBadge';
import { getCanonicalStage } from '../utils/canonicalStages';
import { extractErrorMessage } from '../utils/extractErrorMessage';

type StatusFilter = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'PENDING';
type DetailTab = 'MATRIX' | 'CONSUMPTIONS' | 'ISSUES' | 'RETURNS';

export function ProductionConsumptionWorkspace() {
  const { currentUser } = useAuth();
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedSc, setSelectedSc] = useState<SC | null>(null);
  const [accounting, setAccounting] = useState<MaterialAccounting | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [activeTab, setActiveTab] = useState<DetailTab>('MATRIX');

  // Daily Consumption Modal State
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [consumeItemId, setConsumeItemId] = useState<string>('');
  const [consumeQty, setConsumeQty] = useState('');
  const [consumeRemarks, setConsumeRemarks] = useState('');
  const [submittingConsume, setSubmittingConsume] = useState(false);

  useEffect(() => {
    loadSCs();
  }, []);

  const loadSCs = async (keepSelection = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await workflowService.getScList();
      // Include all SCs that have been submitted, issued, in production, completed, or closed
      const visibleSCs = data.filter(sc => 
        ['SUBMITTED', 'STORES_PENDING', 'PARTIALLY_ISSUED', 'ISSUED', 'IN_PRODUCTION', 'ADDITIONAL_REQUEST', 'COMPLETED', 'CLOSED'].includes(sc.status)
      );
      setScList(visibleSCs);
      if (visibleSCs.length > 0) {
        if (!keepSelection || !selectedSc) {
          selectSc(visibleSCs[0]);
        } else {
          const stillThere = visibleSCs.find(s => s.id === selectedSc.id);
          if (stillThere) {
            selectSc(stillThere);
          } else {
            selectSc(visibleSCs[0]);
          }
        }
      } else {
        setSelectedSc(null);
        setAccounting(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Sales Order Components');
    } finally {
      setLoading(false);
    }
  };

  const selectSc = async (sc: SC) => {
    setSelectedSc(sc);
    await loadAccounting(sc.id);
  };

  const loadAccounting = async (scId: string) => {
    setLoadingAccounting(true);
    try {
      const data = await workflowService.getAccounting(scId);
      setAccounting(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load material accounting report');
    } finally {
      setLoadingAccounting(false);
    }
  };

  const handleRecordConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSc || !consumeItemId) return;
    const qty = Number(consumeQty);
    if (!qty || qty <= 0) {
      toast.error('Please enter a valid consumed quantity (> 0)');
      return;
    }

    setSubmittingConsume(true);
    try {
      await workflowService.recordConsumption(
        selectedSc.id,
        consumeItemId,
        qty,
        consumeRemarks.trim() || undefined
      );
      toast.success('Production consumption logged successfully!');
      setShowConsumeModal(false);
      setConsumeQty('');
      setConsumeRemarks('');
      await loadAccounting(selectedSc.id);
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to record consumption'));
    } finally {
      setSubmittingConsume(false);
    }
  };

  // Filter SC List by Tab & Search Query
  const filteredScList = scList.filter(sc => {
    const q = searchQuery.toLowerCase().trim();
    const poNum = sc.purchaseOrder?.poNumber?.toLowerCase() || '';
    const scNum = sc.scNumber.toLowerCase();
    const prodName = sc.productName.toLowerCase();
    
    const matchesSearch = !q || scNum.includes(q) || poNum.includes(q) || prodName.includes(q) || getCanonicalStage(sc).toLowerCase().includes(q);
    if (!matchesSearch) return false;

    const canonical = getCanonicalStage(sc);
    if (statusFilter === 'IN_PROGRESS') {
      return ['Stores Issued Partially', 'Stores Issued', 'Production Received'].includes(canonical);
    }
    if (statusFilter === 'COMPLETED') {
      return ['COMPLETED', 'CLOSED'].includes(sc.status) || canonical === 'Production Received';
    }
    if (statusFilter === 'PENDING') {
      return ['Draft', 'Stores Pending'].includes(canonical);
    }
    return true;
  });

  // Totals for executive summary cards
  const totalRequired = accounting?.items.reduce((s, i) => s + (Number(i.required) || 0), 0) || 0;
  const totalIssued = accounting?.items.reduce((s, i) => s + (Number(i.issued) || 0), 0) || 0;
  const totalReceived = accounting?.items.reduce((s, i) => s + (Number(i.received) || 0), 0) || 0;
  const totalConsumed = accounting?.items.reduce((s, i) => s + (Number(i.consumed) || 0), 0) || 0;
  const totalReturned = accounting?.items.reduce((s, i) => s + (Number(i.returned) || 0), 0) || 0;
  const totalPendingReturned = accounting?.items.reduce((s, i) => s + (Number(i.pendingReturned) || 0), 0) || 0;
  const totalWipBalance = accounting?.items.reduce((s, i) => s + (Number(i.wip) || 0), 0) || 0;
  const totalUnaccounted = accounting?.items.reduce((s, i) => s + (Number(i.unaccounted) || 0), 0) || 0;

  const overallConsumedPercent = totalIssued > 0 ? Math.round((totalConsumed / totalIssued) * 100) : 0;
  const overallReceivedPercent = totalIssued > 0 ? Math.round((totalReceived / totalIssued) * 100) : 0;

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-indigo-600 dark:text-indigo-400">
              <PlaySquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Material Consumption & Accounting
                </h1>
                <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                  Audit Governance
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time tracking of RM allocations by SC & PO: Required, Issued (Stores), Received (Floor), Consumed, Returned, and Shop Floor WIP.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => {
              if (selectedSc) loadAccounting(selectedSc.id);
              else loadSCs();
            }}
            title="Refresh Report Data"
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-[#161a2e] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1f243d] transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAccounting ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white dark:bg-[#161a2e] border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#1f243d] shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print Report</span>
          </button>

          {(currentUser?.role === 'PRODUCTION' || currentUser?.role === 'ADMIN') && (
            <button
              onClick={() => {
                if (accounting?.items && accounting.items.length > 0) {
                  setConsumeItemId(accounting.items[0].rmItemId);
                }
                setShowConsumeModal(true);
              }}
              disabled={!selectedSc || !accounting || accounting.items.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Log Consumption</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 rounded-xl flex items-center space-x-2 border border-rose-200 dark:border-rose-900/40 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split Layout: SC & PO Filter Drawer on left (4 cols), Comprehensive Accounting on right (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Work Orders & PO Selector */}
        <div className="lg:col-span-4 bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] rounded-xl shadow-xs overflow-hidden flex flex-col h-[780px]">
          <div className="p-3.5 border-b border-slate-100 dark:border-[#1a1e33] bg-slate-50/70 dark:bg-[#161a2e] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Select SC or PO
                </h3>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {filteredScList.length} / {scList.length}
              </span>
            </div>

            {/* Quick Filter Tabs */}
            <div className="grid grid-cols-4 gap-1 p-0.5 bg-slate-200/70 dark:bg-slate-900/60 rounded-lg text-[10px] font-semibold text-center">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('IN_PROGRESS')}
                className={`py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'IN_PROGRESS'
                    ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Closed
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`py-1 rounded-md transition-all cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-white dark:bg-indigo-600 text-slate-900 dark:text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Pending
              </button>
            </div>

            {/* Search Input for SC #, PO #, or Product */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search PO #, SC #, or Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#1a1e33] p-2 space-y-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <span className="text-xs text-slate-400">Loading work orders...</span>
              </div>
            ) : filteredScList.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs space-y-1">
                <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p>No matching work orders found.</p>
                <p className="text-[10px] text-slate-400">Try adjusting your search query or status filter.</p>
              </div>
            ) : (
              filteredScList.map((sc) => {
                const isSelected = selectedSc?.id === sc.id;
                const poNumber = sc.purchaseOrder?.poNumber;
                return (
                  <button
                    key={sc.id}
                    onClick={() => selectSc(sc)}
                    className={`w-full text-left p-3 rounded-lg transition-all text-xs cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 text-slate-900 dark:text-white ring-1 ring-indigo-500/30'
                        : 'hover:bg-slate-50 dark:hover:bg-[#161a2e] border border-transparent text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-900 dark:text-white text-xs">{sc.scNumber}</span>
                        {poNumber && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            PO: {poNumber}
                          </span>
                        )}
                      </div>
                      <StatusBadge status={getCanonicalStage(sc)} className="text-[10px] px-2 py-0.5" />
                    </div>

                    <div className="text-slate-600 dark:text-slate-400 font-medium truncate">{sc.productName}</div>
                    
                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                      <span>Target: <strong className="text-slate-700 dark:text-slate-300">{sc.targetQuantity}</strong> units</span>
                      {sc.createdAt && (
                        <span>{new Date(sc.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Comprehensive Material Accounting Report */}
        <div className="lg:col-span-8 space-y-6">
          {selectedSc ? (
            <>
              {/* Selected SC & PO Summary Banner */}
              <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">SC: {selectedSc.scNumber}</h2>
                    {selectedSc.purchaseOrder?.poNumber && (
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                        Linked PO: {selectedSc.purchaseOrder.poNumber}
                      </span>
                    )}
                    <StatusBadge
                      status={getCanonicalStage({
                        ...selectedSc,
                        totalIssued,
                        totalRequired,
                        totalReceived,
                        isPartiallyIssued: accounting?.isPartiallyIssued,
                      })}
                      className="text-xs px-2.5 py-0.5"
                    />
                    {(accounting?.isPartiallyIssued || (totalIssued < totalRequired && totalIssued > 0)) && (
                      <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                        ({totalIssued}/{totalRequired} Dispatched)
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Finished Product: <strong className="text-slate-900 dark:text-white">{selectedSc.productName}</strong>
                    {' '}| Target Batch: <strong className="text-slate-900 dark:text-white">{selectedSc.targetQuantity} units</strong>
                  </p>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 dark:bg-[#161a2e] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Consumption Rate</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white">
                      {overallConsumedPercent}% Consumed
                    </div>
                  </div>
                  <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-300 dark:border-slate-700">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(overallConsumedPercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Executive Material Accounting KPIs (6 Core Audit Numbers) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">1. Required</div>
                  <div className="text-xl font-black text-slate-900 dark:text-white mt-1">{totalRequired}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Design BOM</div>
                </div>

                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">2. Issued</div>
                  <div className="text-xl font-black text-indigo-700 dark:text-indigo-300 mt-1">{totalIssued}</div>
                  <div className="text-[10px] mt-0.5 whitespace-nowrap">
                    {totalIssued < totalRequired ? (
                      <span className="font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap">
                        {totalRequired - totalIssued} Pending Stores
                      </span>
                    ) : (
                      <span className="text-slate-400">Stores Dispatched</span>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">3. Received</div>
                  <div className="text-xl font-black text-blue-700 dark:text-blue-300 mt-1">{totalReceived}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{overallReceivedPercent}% of Issue</div>
                </div>

                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">4. Consumed</div>
                  <div className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-1">{totalConsumed}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Used in Shifts</div>
                </div>

                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">5. Returned</div>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-300 mt-1">{totalReturned}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {totalPendingReturned > 0 ? `+${totalPendingReturned} pending ack` : 'Stores Re-inwarded'}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] p-3.5 rounded-xl shadow-2xs">
                  <div className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">6. Floor WIP</div>
                  <div className="text-xl font-black text-purple-700 dark:text-purple-300 mt-1">{totalWipBalance}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {totalUnaccounted > 0 ? `Variance: ${totalUnaccounted}` : 'Reconciled WIP'}
                  </div>
                </div>
              </div>

              {/* View Selector Tabs: Matrix, Consumptions, Issues, Returns */}
              <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] rounded-xl shadow-xs overflow-hidden">
                <div className="border-b border-slate-100 dark:border-[#1a1e33] bg-slate-50/70 dark:bg-[#161a2e] px-4 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-1 sm:space-x-2 py-2">
                    <button
                      onClick={() => setActiveTab('MATRIX')}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'MATRIX'
                          ? 'bg-white dark:bg-[#1e233d] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Material Accounting Matrix</span>
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {accounting?.items.length || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('CONSUMPTIONS')}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'CONSUMPTIONS'
                          ? 'bg-white dark:bg-[#1e233d] text-emerald-600 dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Shift Consumption Logs</span>
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {accounting?.consumptions?.length || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('ISSUES')}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'ISSUES'
                          ? 'bg-white dark:bg-[#1e233d] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Stores Dispatches</span>
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {accounting?.issues?.length || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => setActiveTab('RETURNS')}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        activeTab === 'RETURNS'
                          ? 'bg-white dark:bg-[#1e233d] text-amber-600 dark:text-amber-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Surplus Returns</span>
                      <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {accounting?.returns?.length || 0}
                      </span>
                    </button>
                  </div>
                </div>

                {loadingAccounting ? (
                  <div className="flex flex-col items-center justify-center py-20 space-y-2">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    <span className="text-xs text-slate-400">Loading accounting breakdown...</span>
                  </div>
                ) : (
                  <>
                    {/* TAB 1: Material Accounting Matrix */}
                    {activeTab === 'MATRIX' && (
                      <div className="overflow-x-auto">
                        {!accounting || accounting.items.length === 0 ? (
                          <div className="text-center py-16 text-slate-400 text-xs">
                            No material specifications found for this component.
                          </div>
                        ) : (
                          <table className="min-w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-[#161a2e] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1a1e33] font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4 whitespace-nowrap">Material Specification</th>
                                <th className="py-3 px-3 text-right whitespace-nowrap">Required</th>
                                <th className="py-3 px-3 text-right text-indigo-700 dark:text-indigo-400 whitespace-nowrap">Issued</th>
                                <th className="py-3 px-3 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap">Pending Stores</th>
                                <th className="py-3 px-3 text-right text-blue-700 dark:text-blue-400 whitespace-nowrap">Received</th>
                                <th className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Consumed</th>
                                <th className="py-3 px-3 text-right text-amber-700 dark:text-amber-400 whitespace-nowrap">Returned</th>
                                <th className="py-3 px-3 text-right text-purple-700 dark:text-purple-400 whitespace-nowrap">Floor WIP</th>
                                <th className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">Variance</th>
                                <th className="py-3 px-4 text-center whitespace-nowrap">Utilization</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1e33]">
                              {accounting.items.map((item) => {
                                const percent = item.issued > 0 ? Math.round((item.consumed / item.issued) * 100) : 0;
                                const unissued = item.unissued ?? Math.max(0, item.required - item.issued);
                                return (
                                  <tr key={item.rmItemId} className="hover:bg-slate-50/60 dark:hover:bg-[#161a2e]/60 transition-colors">
                                    <td className="py-3 px-4">
                                      <div className="font-bold text-slate-900 dark:text-white">{item.material}</div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                        Grade: {item.grade || 'STD'} | Size: {item.size || 'N/A'}
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{item.required}</td>
                                    <td className="py-3 px-3 text-right font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{item.issued}</td>
                                    <td className="py-3 px-3 text-right font-semibold whitespace-nowrap">
                                      {unissued > 0 ? (
                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-md text-xs font-bold border border-purple-200 dark:border-purple-800 shadow-2xs">
                                          <span>{unissued}</span>
                                          <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">pending</span>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 font-medium">0</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 text-right font-medium text-blue-700 dark:text-blue-400 whitespace-nowrap">{item.received}</td>
                                    <td className="py-3 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{item.consumed}</td>
                                    <td className="py-3 px-3 text-right font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                      <span>{item.returned}</span>
                                      {item.pendingReturned > 0 && (
                                        <span className="block text-[10px] text-amber-500 whitespace-nowrap">(+{item.pendingReturned} pending)</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-3 text-right font-bold text-purple-700 dark:text-purple-400 whitespace-nowrap">{item.wip}</td>
                                    <td className="py-3 px-3 text-right font-medium whitespace-nowrap">
                                      {item.unaccounted === 0 ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">0</span>
                                      ) : (
                                        <span className="text-rose-600 dark:text-rose-400 font-bold">{item.unaccounted}</span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center space-x-2">
                                        <div className="w-14 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-200 dark:border-slate-700">
                                          <div
                                            className="bg-emerald-500 h-1.5 rounded-full"
                                            style={{ width: `${Math.min(percent, 100)}%` }}
                                          />
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-8 text-right">{percent}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 2: Shift Consumption Logs */}
                    {activeTab === 'CONSUMPTIONS' && (
                      <div className="overflow-x-auto">
                        {!accounting?.consumptions || accounting.consumptions.length === 0 ? (
                          <div className="text-center py-16 text-slate-400 text-xs">
                            No shift consumption entries have been logged yet for this component.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-[#161a2e] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1a1e33] font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4">Date & Time</th>
                                <th className="py-3 px-4">Raw Material Item</th>
                                <th className="py-3 px-3 text-right">Quantity Consumed</th>
                                <th className="py-3 px-4">Recorded By</th>
                                <th className="py-3 px-4">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1e33]">
                              {accounting.consumptions.map((entry) => (
                                <tr key={entry.id} className="hover:bg-slate-50/60 dark:hover:bg-[#161a2e]/60 transition-colors">
                                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400 flex items-center space-x-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{new Date(entry.recordedAt).toLocaleString()}</span>
                                  </td>
                                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                                    {entry.material}
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-emerald-700 dark:text-emerald-400">
                                    {entry.consumedQuantity} {entry.unit}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                    {entry.recordedBy}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 italic">
                                    {entry.remarks || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 3: Stores Dispatches (Issues) */}
                    {activeTab === 'ISSUES' && (
                      <div className="overflow-x-auto">
                        {!accounting?.issues || accounting.issues.length === 0 ? (
                          <div className="text-center py-16 text-slate-400 text-xs">
                            No stores dispatches recorded for this component.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-[#161a2e] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1a1e33] font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4">Issue #</th>
                                <th className="py-3 px-4">Date</th>
                                <th className="py-3 px-4">Type</th>
                                <th className="py-3 px-3 text-right">Items Dispatched</th>
                                <th className="py-3 px-4">Dispatched By</th>
                                <th className="py-3 px-4">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1e33]">
                              {accounting.issues.map((iss) => (
                                <tr key={iss.id} className="hover:bg-slate-50/60 dark:hover:bg-[#161a2e]/60 transition-colors">
                                  <td className="py-3 px-4 font-bold text-indigo-700 dark:text-indigo-400">
                                    {iss.issueNumber}
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                    {new Date(iss.createdAt).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      {iss.issueType}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">
                                    {iss.totalQuantity} units ({iss.items?.length || 0} specs)
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                    {iss.issuedBy}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 italic">
                                    {iss.remarks || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}

                    {/* TAB 4: Surplus Returns & Stock Verifications */}
                    {activeTab === 'RETURNS' && (
                      <div className="overflow-x-auto">
                        {!accounting?.returns || accounting.returns.length === 0 ? (
                          <div className="text-center py-16 text-slate-400 text-xs">
                            No material surplus returns logged for this component.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 dark:bg-[#161a2e] text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-[#1a1e33] font-bold uppercase tracking-wider text-[11px]">
                                <th className="py-3 px-4">Return ID</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Returned At</th>
                                <th className="py-3 px-4">Returned By</th>
                                <th className="py-3 px-3 text-right">Quantity Returned</th>
                                <th className="py-3 px-4">Verified By & Date</th>
                                <th className="py-3 px-4">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1a1e33]">
                              {accounting.returns.map((ret) => (
                                <tr key={ret.id} className="hover:bg-slate-50/60 dark:hover:bg-[#161a2e]/60 transition-colors">
                                  <td className="py-3 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                    {ret.id.substring(0, 8)}...
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      ret.status === 'ACKNOWLEDGED'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                    }`}>
                                      {ret.status === 'ACKNOWLEDGED' ? 'VERIFIED IN STOCK' : 'PENDING STORES ACK'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                    {new Date(ret.createdAt).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                    {ret.returnedBy}
                                  </td>
                                  <td className="py-3 px-3 text-right font-black text-amber-700 dark:text-amber-400">
                                    {ret.totalQuantity} units
                                  </td>
                                  <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                                    {ret.confirmedBy ? (
                                      <div>
                                        <div className="font-bold">{ret.confirmedBy}</div>
                                        {ret.confirmedAt && (
                                          <div className="text-[10px] text-slate-400">
                                            {new Date(ret.confirmedAt).toLocaleDateString()}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold italic">Awaiting Verification</span>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-slate-500 dark:text-slate-400 italic">
                                    {ret.remarks || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Complete Material Reconciliation Note */}
              <div className="bg-slate-50 dark:bg-[#161a2e] border border-slate-200 dark:border-[#1a1e33] rounded-xl p-4 text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-3">
                <FileText className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Executive Traceability & Material Accounting Formula</div>
                  <p className="mt-1 text-slate-500 dark:text-slate-400 leading-relaxed">
                    <strong>Floor WIP Balance</strong> = <code>Received - Consumed - (Returned + Pending Returned)</code>. 
                    All stores dispatches have been immutably credited to this component's custody. For extra material requisitions, consult the dedicated <strong>Extra Requests</strong> queue. For physical surplus restitution, use the <strong>Return Verify</strong> queue.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] rounded-xl p-16 text-center text-slate-400 space-y-3">
              <Boxes className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Select a Component or PO</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an active Sales Order Component or search by PO number from the left panel to inspect its complete material consumption and audit statement.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Log Daily Consumption Modal */}
      {showConsumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#1a1e33] rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#1a1e33]">
              <div className="flex items-center space-x-2">
                <PlaySquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Log Production Consumption</h3>
              </div>
              <button
                onClick={() => setShowConsumeModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordConsumption} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Component: {selectedSc?.scNumber}
                  {selectedSc?.purchaseOrder && ` (PO: ${selectedSc.purchaseOrder.poNumber})`}
                </label>
                <div className="text-xs text-slate-500 dark:text-slate-400">{selectedSc?.productName}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Raw Material Item *
                </label>
                <select
                  value={consumeItemId}
                  onChange={(e) => setConsumeItemId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                >
                  {accounting?.items.map((item) => (
                    <option key={item.rmItemId} value={item.rmItemId}>
                      {item.material} - (WIP Balance: {item.wip})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Quantity Consumed in Shift *
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={consumeQty}
                  onChange={(e) => setConsumeQty(e.target.value)}
                  placeholder="e.g. 5"
                  required
                  className="w-full px-3 py-2 bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Shift / Operator Remarks
                </label>
                <input
                  type="text"
                  value={consumeRemarks}
                  onChange={(e) => setConsumeRemarks(e.target.value)}
                  placeholder="e.g. Batch run machining completed on CNC Lathe 1"
                  className="w-full px-3 py-2 bg-white dark:bg-[#161a2e] text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-[#1a1e33]">
                <button
                  type="button"
                  onClick={() => setShowConsumeModal(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#161a2e] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingConsume}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingConsume ? 'Logging...' : 'Confirm Consumption'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
