import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  Check,
  X,
  Power,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { consumablesApi } from '../services/consumables.service';
import type {
  ConsumableItemTrack,
  ConsumableApprovalConfig,
} from '../types/consumables.types';
import { RejectReasonModal } from '../components/consumables/RejectReasonModal';
import { AttachmentBadge, AttachmentViewerModal } from '../components/consumables';
import { PageHeader } from '../components/ui/PageHeader';

type ApprovalTab = 'PENDING' | 'APPROVED' | 'REJECTED';

export const ConsumableApprovalsWorkspace: React.FC = () => {
  const queryClient = useQueryClient();

  // Tab & Filter States
  const [activeTab, setActiveTab] = useState<ApprovalTab>('PENDING');
  const [viewerItem, setViewerItem] = useState<{ id: string; title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState<ConsumableItemTrack | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Selection state for Pending tab
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Notices
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [switchedNotice, setSwitchedNotice] = useState<Array<{ id: string; description: string }> | null>(null);

  // Auth & Permissions
  const { currentUser } = useAuth();
  const isAdminOrGm = currentUser?.role === 'ADMIN' || currentUser?.role === 'GENERAL_MANAGER';
  const [isTogglingMode, setIsTogglingMode] = useState(false);

  // 1. Fetch SM Approval Configuration Mode & Scope
  const { data: configData } = useQuery<ConsumableApprovalConfig>({
    queryKey: ['consumables-approval-config'],
    queryFn: () => consumablesApi.getApprovalConfig(),
    staleTime: 60000,
  });

  // 2. Fetch Live Pending Count for Tab and Sidebar Badge
  const { data: countData, refetch: refetchPendingCount } = useQuery<{ count: number }>({
    queryKey: ['consumables-pending-approval-count'],
    queryFn: () => consumablesApi.getPendingApprovalCount(),
    refetchInterval: 60000,
  });

  const handleToggleMode = async () => {
    const nextMode = configData?.mode === 'ON' ? 'OFF' : 'ON';
    setIsTogglingMode(true);
    try {
      await consumablesApi.updateApprovalConfig({ mode: nextMode });
      toast.success(
        nextMode === 'ON'
          ? 'SM Approval Engine is now ACTIVE (Mode: ON)!'
          : 'SM Approval Engine is now STANDBY (Mode: OFF).'
      );
      queryClient.invalidateQueries({ queryKey: ['consumables-approval-config'] });
      invalidateAll();
    } catch {
      toast.error('Failed to change SM Approval Mode.');
    } finally {
      setIsTogglingMode(false);
    }
  };

  // 3. Fetch Items Query for Current Tab
  const {
    data: approvalsData,
    isLoading,
    isFetching,
    isError,
    refetch: refetchApprovals,
  } = useQuery({
    queryKey: [
      'consumables-approvals',
      activeTab,
      searchTerm,
      trackFilter,
      fromDate,
      toDate,
      page,
      pageSize,
    ],
    queryFn: () =>
      consumablesApi.queryApprovals({
        status: activeTab,
        search: searchTerm.trim() || undefined,
        track: trackFilter !== 'ALL' ? trackFilter : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        page,
        pageSize,
      }),
  });

  const items = useMemo(() => approvalsData?.items || [], [approvalsData]);
  const total = approvalsData?.total || 0;
  const totalPages = approvalsData?.totalPages || 1;

  // Reset selection when tab, search, or filters change
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, searchTerm, trackFilter, fromDate, toDate, page]);

  // Compute selected items and estimated total value
  const selectedItems = useMemo(() => {
    const idSet = new Set(selectedIds);
    return items.filter((item) => idSet.has(item.id));
  }, [items, selectedIds]);

  const estimatedSelectedTotal = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + (item.estimatedTotal || 0), 0);
  }, [selectedItems]);

  // Toggle selection for single item (capped at 200)
  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 200) {
        toast.error('Selection limit reached: maximum 200 items per batch.');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Select all items on the current page (respecting 200 cap)
  const handleSelectAllCurrentPage = () => {
    const currentPageIds = items.map((i) => i.id);
    const allSelected = currentPageIds.every((id) => selectedIds.includes(id));

    if (allSelected) {
      // Deselect all on current page
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      // Select all up to 200
      const combined = Array.from(new Set([...selectedIds, ...currentPageIds]));
      if (combined.length > 200) {
        setSelectedIds(combined.slice(0, 200));
        toast.error('Capped at 200 items max for a single batch action.');
      } else {
        setSelectedIds(combined);
      }
    }
  };

  const isAllCurrentPageSelected =
    items.length > 0 && items.every((i) => selectedIds.includes(i.id));

  // Invalidate queries helper
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['consumables-approvals'] });
    queryClient.invalidateQueries({ queryKey: ['consumables-pending-approval-count'] });
    refetchPendingCount();
    refetchApprovals();
  }, [queryClient, refetchPendingCount, refetchApprovals]);

  // Bulk Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => consumablesApi.bulkApprove(ids),
    onSuccess: (res) => {
      toast.success(`Successfully approved ${res.approvedCount} item(s)!`);
      if (res.switchedToPurchase && res.switchedToPurchase.length > 0) {
        setSwitchedNotice(res.switchedToPurchase);
      }
      setSelectedIds([]);
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to approve items');
    },
  });

  // Bulk Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ ids, reason }: { ids: string[]; reason: string }) =>
      consumablesApi.bulkReject(ids, reason),
    onSuccess: (res) => {
      toast.success(`Successfully rejected ${res.rejectedCount} item(s).`);
      setIsRejectModalOpen(false);
      setSelectedIds([]);
      invalidateAll();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reject items');
    },
  });

  const handleApproveSelected = () => {
    if (selectedIds.length === 0) return;
    approveMutation.mutate(selectedIds);
  };

  const handleConfirmReject = (reason: string) => {
    if (selectedIds.length === 0) return;
    rejectMutation.mutate({ ids: selectedIds, reason });
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Page Title & Top Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5 flex-wrap">
            <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600 dark:text-indigo-400" />
            <span>Senior Manager Approvals</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                configData?.mode === 'ON'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-700'
                  : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700'
              }`}
            >
              {configData?.mode === 'ON' ? 'Mode: ON (Active)' : 'Mode: OFF (Standby)'}
            </span>
          </div>
        }
        subtitle="Review, approve, and authorize consumable requests before store issuance or purchase requisition."
        actionSlot={
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {isAdminOrGm && (
              <button
                type="button"
                onClick={handleToggleMode}
                disabled={isTogglingMode}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg border transition-colors shadow-2xs cursor-pointer ${
                  configData?.mode === 'ON'
                    ? 'bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700'
                }`}
                title="Quick Toggle SM Approval Mode"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{isTogglingMode ? 'Updating...' : configData?.mode === 'ON' ? 'Turn OFF Approvals' : 'Turn ON Approvals'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => invalidateAll()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#161a2e] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      {/* Mode OFF Alert Banner */}
      {configData?.mode === 'OFF' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 shadow-xs">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold">SM Approval Engine is currently in Standby (Mode: OFF)</p>
              <p className="text-amber-700 dark:text-amber-300 leading-relaxed">
                New consumable requests are grandfathered and automatically approved upon creation. Turn ON below or in System Configuration to require mandatory Senior Manager review.
              </p>
            </div>
          </div>
          {isAdminOrGm && (
            <button
              type="button"
              onClick={handleToggleMode}
              disabled={isTogglingMode}
              className="shrink-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-center"
            >
              <Power className="w-3.5 h-3.5" />
              <span>{isTogglingMode ? 'Switching...' : 'Turn ON Approvals'}</span>
            </button>
          )}
        </div>
      )}

      {/* Switched to Purchase Queue Notice Modal/Banner */}
      {switchedNotice && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 shadow-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-xs flex-1 space-y-1.5">
            <p className="font-bold">Live Stock Allocation Adjustment</p>
            <p className="text-blue-700 dark:text-blue-300">
              The following {switchedNotice.length} item(s) had insufficient warehouse stock at approval time and
              were automatically transitioned to the <strong>Purchase Queue (NON_STOCK_OR_NEW)</strong>:
            </p>
            <ul className="list-disc list-inside space-y-0.5 font-medium">
              {switchedNotice.map((item) => (
                <li key={item.id}>
                  {item.description} <span className="font-mono text-[10px] text-blue-500">({item.id})</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setSwitchedNotice(null)}
            className="p-1 rounded text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors cursor-pointer"
            aria-label="Dismiss notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
        <button
          type="button"
          onClick={() => {
            setActiveTab('PENDING');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'PENDING'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Pending Approval</span>
          {(countData?.count || 0) > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
              {countData?.count}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('APPROVED');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'APPROVED'
              ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Approved</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('REJECTED');
            setPage(1);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'REJECTED'
              ? 'border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <XCircle className="w-4 h-4" />
          <span>Rejected</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white dark:bg-[#111422] p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Search item, code, requester..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#161a2e] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Track Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={trackFilter}
            onChange={(e) => {
              setTrackFilter(e.target.value as any);
              setPage(1);
            }}
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#161a2e] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          >
            <option value="ALL">All Categories & Tracks</option>
            <option value="STOCK_ITEM">Store Issue (In-Stock Track)</option>
            <option value="NON_STOCK_OR_NEW">Purchase Track (Non-Stock / New)</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            title="Created Date From"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#161a2e] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          />
        </div>

        {/* Date To */}
        <div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            title="Created Date To"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#161a2e] text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer"
          />
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-[#111422] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Loading approval queue...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Failed to load approvals</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              An error occurred while communicating with the backend approval service.
            </p>
            <button
              type="button"
              onClick={() => refetchApprovals()}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer shadow-xs"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {activeTab === 'PENDING'
                ? 'No Pending Items'
                : activeTab === 'APPROVED'
                ? 'No Approved Records Found'
                : 'No Rejected Records Found'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
              {activeTab === 'PENDING'
                ? 'All consumable line items have been reviewed and authorized.'
                : 'Adjust your search or date filters to inspect historical records.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  {activeTab === 'PENDING' && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={isAllCurrentPageSelected}
                        onChange={handleSelectAllCurrentPage}
                        title="Select all on this page (max 200)"
                        className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Request</th>
                  <th className="py-3 px-4">Item & Product Code</th>
                  <th className="py-3 px-4">Routing Track</th>
                  <th className="py-3 px-4 text-right">Qty / UOM</th>
                  <th className="py-3 px-4 text-right">Est. Value</th>
                  <th className="py-3 px-4">Requester & Bay</th>
                  <th className="py-3 px-4">Created Date</th>
                  {activeTab !== 'PENDING' && (
                    <>
                      <th className="py-3 px-4">
                        {activeTab === 'APPROVED' ? 'Approved By' : 'Rejected By'}
                      </th>
                      <th className="py-3 px-4">Action Date</th>
                      {activeTab === 'REJECTED' && <th className="py-3 px-4">Rejection Reason</th>}
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {items.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <tr
                      key={item.id}
                      onClick={() => activeTab === 'PENDING' && handleToggleRow(item.id)}
                      className={`transition-colors ${
                        activeTab === 'PENDING' ? 'cursor-pointer' : ''
                      } ${
                        isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/20'
                          : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {activeTab === 'PENDING' && (
                        <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleRow(item.id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Request Code */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {item.requestCode || '—'}
                      </td>

                      {/* Description & Product Code */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {item.description}
                          </p>
                          <AttachmentBadge
                            count={item.attachmentCount}
                            onClick={() => setViewerItem({ id: item.id, title: item.description })}
                          />
                        </div>
                        {item.productCode && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            {item.productCode}
                          </p>
                        )}
                        {item.lineDescription && (
                          <div className="mt-1.5 p-2 rounded-md bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                            <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">
                              Description / Note:
                            </span>
                            <p className="whitespace-pre-wrap break-words">{item.lineDescription}</p>
                          </div>
                        )}
                      </td>

                      {/* Track Badge */}
                      <td className="py-3 px-4">
                        {item.itemCategoryTrack === 'STOCK_ITEM' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Store Issue
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            Purchase Queue
                          </span>
                        )}
                      </td>

                      {/* Qty & UOM */}
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {item.requestedQty} <span className="text-[10px] text-slate-400">{item.uom}</span>
                      </td>

                      {/* Estimated Value */}
                      <td className="py-3 px-4 text-right font-mono">
                        {item.estimatedTotal != null ? (
                          <span className="text-slate-900 dark:text-white font-bold">
                            ₹{item.estimatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                        {item.unitPrice != null && (
                          <p className="text-[9px] text-slate-400 font-mono">
                            @ ₹{item.unitPrice.toFixed(2)}/{item.uom}
                          </p>
                        )}
                      </td>

                      {/* Requester & End User */}
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {item.requestedBy || '—'}
                        </p>
                        {item.endUserInVelan && (
                          <p className="text-[10px] text-slate-400 truncate">{item.endUserInVelan}</p>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Read-Only Approved / Rejected Metadata */}
                      {activeTab !== 'PENDING' && (
                        <>
                          <td className="py-3 px-4 text-[11px] font-medium text-slate-800 dark:text-slate-200">
                            {activeTab === 'APPROVED'
                              ? item.approvedBy?.name || item.approvedById || 'Senior Manager'
                              : item.rejectedBy?.name || item.rejectedById || 'Senior Manager'}
                          </td>
                          <td className="py-3 px-4 text-[11px] text-slate-500 dark:text-slate-400">
                            {activeTab === 'APPROVED' && item.approvedAt
                              ? new Date(item.approvedAt).toLocaleString()
                              : activeTab === 'REJECTED' && item.rejectedAt
                              ? new Date(item.rejectedAt).toLocaleString()
                              : '—'}
                          </td>
                          {activeTab === 'REJECTED' && (
                            <td className="py-3 px-4 text-xs text-rose-600 dark:text-rose-400 max-w-xs truncate" title={item.rejectionReason || ''}>
                              {item.rejectionReason || '—'}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing <span className="font-bold text-slate-900 dark:text-white">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-slate-900 dark:text-white">
                {Math.min(page * pageSize, total)}
              </span>{' '}
              of <span className="font-bold text-slate-900 dark:text-white">{total}</span> items
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161a2e] text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161a2e] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-slate-900 dark:text-white font-bold px-1">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#161a2e] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
                aria-label="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Batch Action Bar */}
      {activeTab === 'PENDING' && selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-3xl bg-slate-900/95 dark:bg-[#161a2e]/95 text-white backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700/60 p-3.5 flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-mono text-xs font-bold">
              {selectedIds.length} Selected
            </div>
            {estimatedSelectedTotal > 0 && (
              <span className="text-xs text-slate-300 font-mono">
                Est. Total: <span className="font-bold text-white">₹{estimatedSelectedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </span>
            )}
            {selectedIds.length === 200 && (
              <span className="text-[10px] text-amber-400 font-medium">
                (Batch limit 200 reached)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg transition-colors cursor-pointer"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => setIsRejectModalOpen(true)}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reject Selected</span>
            </button>

            <button
              type="button"
              onClick={handleApproveSelected}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              {approveMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Approving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Selected</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      <RejectReasonModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={handleConfirmReject}
        items={selectedItems.map((item) => ({
          id: item.id,
          description: item.description,
          requestCode: item.requestCode,
          requestedQty: item.requestedQty,
          uom: item.uom,
        }))}
        isSubmitting={rejectMutation.isPending}
      />

      <AttachmentViewerModal
        isOpen={Boolean(viewerItem)}
        lineItemId={viewerItem?.id ?? null}
        itemTitle={viewerItem?.title}
        onClose={() => setViewerItem(null)}
      />
    </div>
  );
};
