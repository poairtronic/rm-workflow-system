import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  Layers,
  Plus,
  Trash2,
  Package,
  CheckCircle2,
  Search,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { APP_CONFIG } from '../../app/config';
import { ecrIssuesService } from '../../services/ecrIssues.service';
import type {
  EcrIssuePending,
  EcrIssueDetail,
  RmIssuedItem,
} from '../../types/ecrIssues.types';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { EmptyState } from '../../components/ui/EmptyState';
import { PageHeader } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';

interface SelectedIssueRow {
  key: string; // unique identifier
  rmItemId?: string;
  productId: string;
  productName: string;
  spec: string | null;
  binId: string;
  binLabel: string;
  quantityIssued: number;
  maxQty: number;
  isCustom?: boolean;
}

export function EcrMaterialIssue() {
  const queryClient = useQueryClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detail, setDetail] = useState<EcrIssueDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const res = await ecrIssuesService.syncEcrIssues();
      if (res && res.syncedCount > 0) {
        toast.success(`Synced ${res.syncedCount} new approved report(s) from ECR`);
      } else {
        toast.success(res?.message || 'ECR reports are up to date');
      }
      await queryClient.invalidateQueries({ queryKey: ['ecr-issues'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync with ECR');
    } finally {
      setIsSyncing(false);
    }
  };

  // Selected issue items map: key -> SelectedIssueRow
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, SelectedIssueRow>>({});

  // Collapsible Section 2: Add New Material
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [newSelectedProductId, setNewSelectedProductId] = useState('');
  const [newSelectedBinId, setNewSelectedBinId] = useState('');
  const [newProductQty, setNewProductQty] = useState<number>(1);

  // 1. Fetch ECR pending issues
  const {
    data: issues = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<EcrIssuePending[]>({
    queryKey: ['ecr-issues'],
    queryFn: async () => {
      return await ecrIssuesService.getEcrIssues();
    },
  });

  // 2. Socket.IO Real-time listener for incoming ECR material issues
  useEffect(() => {
    const token = localStorage.getItem('rm_access_token');
    if (!token) return;

    const backendUrl = APP_CONFIG.apiBaseUrl || 'http://localhost:3001';
    const socket: Socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on('notification', (payload: any) => {
      if (payload?.type === 'ECR_ISSUE') {
        toast('New ECR material issue pending notification', {
          icon: '🔔',
          duration: 4000,
        });
        queryClient.invalidateQueries({ queryKey: ['ecr-issues'] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  // 3. Open Modal and fetch detail
  const handleOpenIssueModal = async (issue: EcrIssuePending) => {
    setIsModalOpen(true);
    setLoadingDetail(true);
    setSelectedItemsMap({});
    setIsAddingNew(false);
    setProductSearch('');
    setNewSelectedProductId('');
    setNewSelectedBinId('');
    setNewProductQty(1);

    try {
      const data = await ecrIssuesService.getEcrIssueById(issue.id);
      setDetail(data);

      // By default, if there is a primary RM item matching quantityAffected and in stock, pre-select it
      const initialMap: Record<string, SelectedIssueRow> = {};
      if (data.rmItems && data.rmItems.length > 0) {
        // Pre-select first item with positive stock if available
        const firstWithStock = data.rmItems.find((it) => it.currentBinStock > 0);
        if (firstWithStock) {
          const key = `rm_${firstWithStock.productId}_${firstWithStock.binId}`;
          initialMap[key] = {
            key,
            rmItemId: firstWithStock.rmItemId,
            productId: firstWithStock.productId,
            productName: firstWithStock.productName,
            spec: firstWithStock.spec,
            binId: firstWithStock.binId,
            binLabel: `${firstWithStock.rackCode} > ${firstWithStock.binCode}`,
            quantityIssued: Math.min(issue.quantityAffected, firstWithStock.currentBinStock) || 1,
            maxQty: firstWithStock.currentBinStock,
            isCustom: false,
          };
        }
      }
      setSelectedItemsMap(initialMap);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load issue details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setDetail(null);
    setSelectedItemsMap({});
    setIsAddingNew(false);
    setProductSearch('');
    setNewSelectedProductId('');
    setNewSelectedBinId('');
    setNewProductQty(1);
    setSubmitting(false);
  };

  // Toggle RM item selection
  const handleToggleRmItem = (item: RmIssuedItem) => {
    if (item.currentBinStock <= 0) return;
    const key = `rm_${item.productId}_${item.binId}`;

    setSelectedItemsMap((prev) => {
      const updated = { ...prev };
      if (updated[key]) {
        delete updated[key];
      } else {
        updated[key] = {
          key,
          rmItemId: item.rmItemId,
          productId: item.productId,
          productName: item.productName,
          spec: item.spec,
          binId: item.binId,
          binLabel: `${item.rackCode} > ${item.binCode}`,
          quantityIssued: 1,
          maxQty: item.currentBinStock,
          isCustom: false,
        };
      }
      return updated;
    });
  };

  // Update quantity for any selected item
  const handleQuantityChange = (key: string, qty: number) => {
    setSelectedItemsMap((prev) => {
      const row = prev[key];
      if (!row) return prev;
      return {
        ...prev,
        [key]: {
          ...row,
          quantityIssued: Math.max(0, qty),
        },
      };
    });
  };

  // Remove a custom added row
  const handleRemoveCustomRow = (key: string) => {
    setSelectedItemsMap((prev) => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // Filter available products for Section 2
  const filteredAvailableProducts = useMemo(() => {
    if (!detail?.allAvailableProducts) return [];
    const query = productSearch.trim().toLowerCase();
    if (!query) return detail.allAvailableProducts;
    return detail.allAvailableProducts.filter(
      (p) =>
        p.productName.toLowerCase().includes(query) ||
        (p.spec && p.spec.toLowerCase().includes(query)),
    );
  }, [detail, productSearch]);

  const selectedNewProduct = useMemo(() => {
    if (!detail?.allAvailableProducts || !newSelectedProductId) return null;
    return detail.allAvailableProducts.find((p) => p.productId === newSelectedProductId) || null;
  }, [detail, newSelectedProductId]);

  const selectedNewBin = useMemo(() => {
    if (!selectedNewProduct || !newSelectedBinId) return null;
    return selectedNewProduct.bins.find((b) => b.binId === newSelectedBinId) || null;
  }, [selectedNewProduct, newSelectedBinId]);

  // Add custom new product to issue list
  const handleAddNewProductRow = () => {
    if (!selectedNewProduct || !selectedNewBin) {
      toast.error('Please select both a product and a bin');
      return;
    }
    if (newProductQty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }
    if (newProductQty > selectedNewBin.currentQty) {
      toast.error(`Quantity cannot exceed available bin stock (${selectedNewBin.currentQty})`);
      return;
    }

    const key = `custom_${selectedNewProduct.productId}_${selectedNewBin.binId}`;
    if (selectedItemsMap[key]) {
      toast.error('This product and bin combination is already in the issue list');
      return;
    }

    setSelectedItemsMap((prev) => ({
      ...prev,
      [key]: {
        key,
        productId: selectedNewProduct.productId,
        productName: selectedNewProduct.productName,
        spec: selectedNewProduct.spec,
        binId: selectedNewBin.binId,
        binLabel: `${selectedNewBin.rackCode} > ${selectedNewBin.binCode}`,
        quantityIssued: newProductQty,
        maxQty: selectedNewBin.currentQty,
        isCustom: true,
      },
    }));

    toast.success(`Added ${selectedNewProduct.productName} to issue list`);
    // Reset form
    setNewSelectedProductId('');
    setNewSelectedBinId('');
    setNewProductQty(1);
    setIsAddingNew(false);
  };

  // Computed summary
  const selectedRowsArray = useMemo(() => Object.values(selectedItemsMap), [selectedItemsMap]);
  const totalItemsCount = selectedRowsArray.length;
  const totalQuantity = useMemo(
    () => selectedRowsArray.reduce((sum, item) => sum + (Number(item.quantityIssued) || 0), 0),
    [selectedRowsArray],
  );

  const hasInvalidQuantities = useMemo(() => {
    if (selectedRowsArray.length === 0) return true;
    return selectedRowsArray.some(
      (item) => !item.quantityIssued || item.quantityIssued <= 0 || item.quantityIssued > item.maxQty,
    );
  }, [selectedRowsArray]);

  // Submit Issue
  const handleConfirmIssue = async () => {
    if (!detail) return;
    if (selectedRowsArray.length === 0) {
      toast.error('Please select at least one material item to issue.');
      return;
    }

    for (const item of selectedRowsArray) {
      if (item.quantityIssued <= 0) {
        toast.error(`Quantity for "${item.productName}" must be greater than 0.`);
        return;
      }
      if (item.quantityIssued > item.maxQty) {
        toast.error(
          `Insufficient stock for "${item.productName}". Available in bin: ${item.maxQty}, requested: ${item.quantityIssued}.`,
        );
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        items: selectedRowsArray.map((row) => ({
          productId: row.productId,
          binId: row.binId,
          quantityIssued: row.quantityIssued,
        })),
      };

      await ecrIssuesService.issueEcrMaterial(detail.id, payload);
      toast.success(`Material issued successfully for SC ${detail.scNumber}. ECR updated.`);
      handleCloseModal();
      queryClient.invalidateQueries({ queryKey: ['ecr-issues'] });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || '';
      if (typeof errMsg === 'string' && errMsg.includes('Insufficient stock')) {
        toast.error(errMsg);
      } else {
        toast.error(typeof errMsg === 'string' && errMsg ? errMsg : 'Failed to issue material');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Table Columns
  const columns: ColumnDef<EcrIssuePending>[] = [
    {
      key: 'reportNumber',
      header: 'Report #',
      render: (row: EcrIssuePending) => (
        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
          {row.reportNumber}
        </span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row: EcrIssuePending) => {
        const isRework = row.type === 'REWORK';
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide uppercase ${
              isRework
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {row.type}
          </span>
        );
      },
    },
    {
      key: 'scNumber',
      header: 'SC #',
      render: (row: EcrIssuePending) => (
        <span className="font-mono text-slate-800 dark:text-slate-200 font-medium">
          {row.scNumber}
        </span>
      ),
    },
    {
      key: 'poNumber',
      header: 'PO #',
      render: (row: EcrIssuePending) => (
        <span className="font-mono text-slate-600 dark:text-slate-400">
          {row.poNumber || '—'}
        </span>
      ),
    },
    {
      key: 'component',
      header: 'Component',
      render: (row: EcrIssuePending) => (
        <span className="font-medium text-slate-900 dark:text-white">
          {row.component}
        </span>
      ),
    },
    {
      key: 'quantityAffected',
      header: 'Qty Affected',
      render: (row: EcrIssuePending) => (
        <span className="font-semibold text-slate-900 dark:text-slate-100">
          {row.quantityAffected}
        </span>
      ),
    },
    {
      key: 'currentStock',
      header: 'Available Stock',
      render: (row: EcrIssuePending) => {
        const stock = row.currentStock ?? 0;
        const isEnough = stock >= row.quantityAffected;
        return (
          <span
            className={`font-mono text-xs px-2 py-0.5 rounded-md font-semibold ${
              stock === 0
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                : isEnough
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
            }`}
          >
            {stock}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row: EcrIssuePending) => {
        const isPending = row.status === 'PENDING';
        return (
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              isPending
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {row.status}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row: EcrIssuePending) => {
        if (row.status === 'ISSUED') {
          return (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Issued
            </span>
          );
        }
        return (
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
            onClick={() => handleOpenIssueModal(row)}
          >
            <Package className="w-3.5 h-3.5 mr-1" />
            Issue Material
          </Button>
        );
      },
    },
  ];

  return (
    <div className="w-full pb-24 space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            ECR Material Issue
          </span>
        }
        subtitle="Issue replacement material for approved rework and rejection reports"
        actionSlot={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync with ECR'}
          </Button>
        }
      />

      {/* Render Table States */}
      {isLoading ? (
        <LoadingState text="Loading ECR material issues..." />
      ) : isError ? (
        <ErrorState
          message={(error as any)?.message || 'Failed to load ECR material issues'}
          onRetry={() => refetch()}
        />
      ) : issues.length === 0 ? (
        <EmptyState
          title="No ECR Material Issues"
          description="There are currently no rework or rejection replacement requests pending material issuance."
        />
      ) : (
        <DataTable
          columns={columns}
          data={issues}
          searchable={true}
          searchKeys={['reportNumber', 'scNumber', 'component']}
          pagination={true}
          defaultPageSize={10}
        />
      )}

      {/* Redesigned Issue Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title="Issue ECR Replacement Material"
        className="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {totalItemsCount}
              </span>{' '}
              product{totalItemsCount !== 1 ? 's' : ''} selected &bull; Total Qty:{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {totalQuantity}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" onClick={handleCloseModal} disabled={submitting}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                disabled={loadingDetail || submitting || totalItemsCount === 0 || hasInvalidQuantities}
                onClick={handleConfirmIssue}
              >
                {submitting ? 'Confirming...' : 'Confirm Issue'}
              </Button>
            </div>
          </div>
        }
      >
        {loadingDetail ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Loading previously issued RM items and inventory stock...
            </p>
          </div>
        ) : detail ? (
          <div className="space-y-5 text-sm">
            {/* Modal Header Badge Box */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1a1e33] border border-slate-200 dark:border-[#262c4a] grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report #</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                  {detail.reportNumber}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SC #</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                  {detail.scNumber}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PO #</p>
                <p className="font-mono font-semibold text-slate-900 dark:text-white mt-0.5">
                  {detail.poNumber || '—'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Affected Qty</p>
                <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                  {detail.quantityAffected} units ({detail.type})
                </p>
              </div>
            </div>

            {/* SECTION 1 — RM Items Issued to this SC */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    RM Items Issued to this SC
                  </h4>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Select RM items to re-issue for this {detail.type.toLowerCase()}
                </span>
              </div>

              {detail.rmItems && detail.rmItems.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 uppercase font-semibold">
                      <tr>
                        <th className="p-3 w-10 text-center">Select</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Spec</th>
                        <th className="p-3">Bin (Rack &gt; Bin)</th>
                        <th className="p-3 text-right">Original Issued</th>
                        <th className="p-3 text-right">Available Stock</th>
                        <th className="p-3 w-32 text-right">Issue Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {detail.rmItems.map((item) => {
                        const key = `rm_${item.productId}_${item.binId}`;
                        const isSelected = !!selectedItemsMap[key];
                        const isOutOfStock = item.currentBinStock <= 0;
                        const rowQty = selectedItemsMap[key]?.quantityIssued ?? 1;

                        return (
                          <tr
                            key={key}
                            className={`transition-colors ${
                              isOutOfStock
                                ? 'bg-slate-50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500'
                                : isSelected
                                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-slate-900 dark:text-slate-100'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                disabled={isOutOfStock}
                                checked={isSelected}
                                onChange={() => handleToggleRmItem(item)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              />
                            </td>
                            <td className="p-3 font-semibold">
                              {item.productName}
                              {isOutOfStock && (
                                <span className="ml-2 text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">
                                  Out of Stock
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-slate-500 dark:text-slate-400">
                              {item.spec || '—'}
                            </td>
                            <td className="p-3 font-mono text-[11px]">
                              {item.rackCode} &gt; {item.binCode}
                            </td>
                            <td className="p-3 text-right font-medium">{item.originalIssuedQty}</td>
                            <td className="p-3 text-right">
                              <span
                                className={`font-mono font-semibold px-2 py-0.5 rounded text-[11px] ${
                                  isOutOfStock
                                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                }`}
                              >
                                {item.currentBinStock}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {isSelected ? (
                                <input
                                  type="number"
                                  min={1}
                                  max={item.currentBinStock}
                                  value={rowQty}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      key,
                                      parseInt(e.target.value, 10) || 0,
                                    )
                                  }
                                  className={`w-24 px-2 py-1 text-right text-xs font-semibold rounded-lg border bg-white dark:bg-[#141829] focus:outline-none focus:ring-2 ${
                                    rowQty > item.currentBinStock || rowQty <= 0
                                      ? 'border-rose-400 ring-rose-400 text-rose-600'
                                      : 'border-slate-300 dark:border-slate-700 ring-emerald-500'
                                  }`}
                                />
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Unselected</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-center text-xs">
                  No RM items were previously issued to this SC. Use the &quot;Add New Product&quot; option below.
                </div>
              )}
            </div>

            {/* Custom Added New Product Rows (if any) */}
            {selectedRowsArray.filter((r) => r.isCustom).length > 0 && (
              <div className="space-y-2">
                <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Additional Products to Issue
                </h5>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/30 overflow-hidden">
                  {selectedRowsArray
                    .filter((r) => r.isCustom)
                    .map((row) => (
                      <div
                        key={row.key}
                        className="p-3 flex items-center justify-between text-xs gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {row.productName}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold uppercase">
                              New Product
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Spec: {row.spec || '—'} &bull; Bin: {row.binLabel} &bull; Max Available: {row.maxQty}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500 text-[11px]">Qty:</span>
                            <input
                              type="number"
                              min={1}
                              max={row.maxQty}
                              value={row.quantityIssued}
                              onChange={(e) =>
                                handleQuantityChange(row.key, parseInt(e.target.value, 10) || 0)
                              }
                              className={`w-20 px-2 py-1 text-right text-xs font-semibold rounded-lg border bg-white dark:bg-[#141829] focus:outline-none focus:ring-2 ${
                                row.quantityIssued > row.maxQty || row.quantityIssued <= 0
                                  ? 'border-rose-400 ring-rose-400 text-rose-600'
                                  : 'border-slate-300 dark:border-slate-700 ring-emerald-500'
                              }`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomRow(row.key)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* SECTION 2 — Add New Material (Collapsible) */}
            <div className="pt-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-full flex items-center justify-center gap-1.5 border-dashed border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setIsAddingNew((prev) => !prev)}
              >
                {isAddingNew ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide &quot;Add New Product&quot; Picker
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    + Add New Product (From Master Inventory)
                  </>
                )}
              </Button>

              {isAddingNew && (
                <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Select Available Product from Stock
                    </h5>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Products with current quantity &gt; 0
                    </span>
                  </div>

                  {/* Search box */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search product name or spec..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {/* Product Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Product
                      </label>
                      <select
                        value={newSelectedProductId}
                        onChange={(e) => {
                          setNewSelectedProductId(e.target.value);
                          setNewSelectedBinId('');
                        }}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                      >
                        <option value="">-- Choose Product ({filteredAvailableProducts.length} available) --</option>
                        {filteredAvailableProducts.map((p) => (
                          <option key={p.productId} value={p.productId}>
                            {p.productName} {p.spec ? `(${p.spec})` : ''} - Total: {p.totalStock}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Bin
                      </label>
                      <select
                        disabled={!selectedNewProduct}
                        value={newSelectedBinId}
                        onChange={(e) => setNewSelectedBinId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary font-medium disabled:opacity-50"
                      >
                        <option value="">-- Choose Bin --</option>
                        {selectedNewProduct?.bins.map((b) => (
                          <option key={b.binId} value={b.binId}>
                            {b.rackCode} &gt; {b.binCode} ({b.currentQty} in stock)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quantity and Add Button */}
                  {selectedNewBin && (
                    <div className="flex items-end gap-3 pt-1">
                      <div className="w-32">
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedNewBin.currentQty}
                          value={newProductQty}
                          onChange={(e) => setNewProductQty(Math.max(1, parseInt(e.target.value, 10) || 0))}
                          className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        onClick={handleAddNewProductRow}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add to Issue List
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Warning if any item has invalid or insufficient stock */}
            {hasInvalidQuantities && selectedRowsArray.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-center gap-2 text-xs font-medium">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>One or more selected items have invalid quantity or exceed available bin stock.</span>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default EcrMaterialIssue;
