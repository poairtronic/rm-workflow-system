import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  FileText,
  User,
  Hash,
  Boxes,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { mercIndentService } from '../../services/mercIndent.service';
import { masterDataService, type Bin } from '../../services/masterDataService';
import type {
  MercIndentFullDetail,
  SuggestedProduct,
} from '../../types/mercIndent.types';

interface LineItemFormState {
  productId: string;
  binId: string;
  quantityToIssue: number;
  searchFilter: string;
  isCreateMode: boolean;
  newProductName: string;
  newProductDesc: string;
  newProductInitialStock: number;
  newProductBinId: string;
  creatingProduct: boolean;
  issuing: boolean;
  error?: string | null;
}

export function MercIndentIssueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formStates, setFormStates] = useState<Record<string, LineItemFormState>>({});
  const [allBins, setAllBins] = useState<Bin[]>([]);
  const [loadingBins, setLoadingBins] = useState(false);

  // 1. Fetch full detail of indent with suggested products and bins
  const {
    data: indent,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<MercIndentFullDetail>({
    queryKey: ['merc-indent-full', id],
    queryFn: async () => {
      if (!id) throw new Error('Missing indent ID');
      return await mercIndentService.getMercIndentFullDetail(id);
    },
    enabled: !!id,
  });

  // 2. Load all warehouse bins for the "+ New Product" inline creation
  useEffect(() => {
    let isMounted = true;
    async function loadMasterBins() {
      try {
        setLoadingBins(true);
        const res = await masterDataService.getBins({ pageSize: 1000, isActive: true });
        if (isMounted) {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          setAllBins(list);
        }
      } catch (err: any) {
        console.warn('Could not load master bins:', err?.message);
      } finally {
        if (isMounted) setLoadingBins(false);
      }
    }
    loadMasterBins();
    return () => {
      isMounted = false;
    };
  }, []);

  // 3. Initialize / sync form states per line item when data arrives
  useEffect(() => {
    const items = Array.isArray(indent?.lineItems) ? indent.lineItems : [];
    if (items.length === 0) return;

    setFormStates((prev) => {
      const next: Record<string, LineItemFormState> = { ...prev };

      for (const item of items) {
        if (!item || next[item.id]) continue; // keep existing user inputs

        const remaining = Math.max(
          0,
          Number(item.quantityRequired) - Number(item.quantityIssued || 0),
        );

        // Pre-select first suggested product with available stock
        const suggested = Array.isArray(item.suggestedProducts) ? item.suggestedProducts : [];
        const firstWithStock = suggested.find(
          (p) => Array.isArray(p?.bins) && p.bins.some((b) => b?.currentQty > 0),
        );
        const defaultProd = firstWithStock || suggested[0];
        const defaultProdId = defaultProd ? defaultProd.productId : '';

        // Pre-select first bin with stock
        const bins = Array.isArray(defaultProd?.bins) ? defaultProd.bins : [];
        const validBin = bins.find((b) => b?.currentQty > 0) || bins[0];
        const defaultBinId = validBin ? validBin.binId : '';

        const defaultQty = validBin
          ? Math.min(remaining > 0 ? remaining : 1, validBin.currentQty || 1)
          : remaining > 0
          ? remaining
          : 1;

        const descParts: string[] = [];
        if (item.material) descParts.push(item.material);
        if (item.shape) descParts.push(item.shape);

        next[item.id] = {
          productId: defaultProdId,
          binId: defaultBinId,
          quantityToIssue: defaultQty,
          searchFilter: '',
          isCreateMode: false,
          newProductName: item.name || '',
          newProductDesc: descParts.join(' | '),
          newProductInitialStock: remaining > 0 ? remaining : 1,
          newProductBinId: '',
          creatingProduct: false,
          issuing: false,
          error: null,
        };
      }

      return next;
    });
  }, [indent]);

  // Update specific line item form state
  const updateItemState = (itemId: string, patch: Partial<LineItemFormState>) => {
    setFormStates((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...patch,
      },
    }));
  };

  // Handle changing product selection for an item
  const handleProductChange = (
    itemId: string,
    productId: string,
    suggestedProducts: SuggestedProduct[],
    itemReq: number,
    itemIssued: number,
  ) => {
    if (productId === '__CREATE_NEW__') {
      updateItemState(itemId, { isCreateMode: true, error: null });
      return;
    }

    const prods = Array.isArray(suggestedProducts) ? suggestedProducts : [];
    const prod = prods.find((p) => p?.productId === productId);
    const bins = Array.isArray(prod?.bins) ? prod.bins : [];
    const validBin = bins.find((b) => b?.currentQty > 0) || bins[0];
    const binId = validBin ? validBin.binId : '';

    const remaining = Math.max(0, itemReq - itemIssued);
    const qty = validBin
      ? Math.min(remaining > 0 ? remaining : 1, validBin.currentQty || 1)
      : remaining > 0
      ? remaining
      : 1;

    updateItemState(itemId, {
      productId,
      binId,
      quantityToIssue: qty,
      isCreateMode: false,
      error: null,
    });
  };

  // Handle inline "Create as New Product" submission
  const handleCreateNewProduct = async (itemId: string, itemUnit: string | null) => {
    const state = formStates[itemId];
    if (!state) return;

    if (!state.newProductName.trim()) {
      toast.error('Product name is required');
      return;
    }

    updateItemState(itemId, { creatingProduct: true, error: null });
    try {
      const payload = {
        name: state.newProductName.trim(),
        description: state.newProductDesc.trim() || undefined,
        unitId: itemUnit || 'NOS',
        initialStock: state.newProductInitialStock > 0 ? Number(state.newProductInitialStock) : undefined,
        binId: state.newProductBinId || undefined,
      };

      const result = await mercIndentService.createAndStockProduct(payload);
      toast.success(`Product "${result.name}" created successfully`);

      // Refresh indent full detail to get fresh product suggestions & bins
      const refreshed = await mercIndentService.getMercIndentFullDetail(id!);
      queryClient.setQueryData(['merc-indent-full', id], refreshed);

      // Select newly created product and bin
      updateItemState(itemId, {
        productId: result.id,
        binId: result.binId || '',
        quantityToIssue:
          result.initialStock > 0
            ? Math.min(state.quantityToIssue, result.initialStock)
            : state.quantityToIssue,
        isCreateMode: false,
        creatingProduct: false,
        error: null,
      });
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || 'Failed to create product';
      toast.error(errMsg);
      updateItemState(itemId, { creatingProduct: false, error: errMsg });
    }
  };

  // Handle issuing stock for a single line item
  const handleIssueItem = async (item: MercIndentFullDetail['lineItems'][0]) => {
    if (!indent || !item) return;
    const state = formStates[item.id];
    if (!state) return;

    if (!state.productId) {
      toast.error('Please select an RM product');
      return;
    }
    if (!state.binId) {
      toast.error('Please select a storage bin');
      return;
    }
    if (state.quantityToIssue <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    // Verify stock in selected bin
    const prods = Array.isArray(item.suggestedProducts) ? item.suggestedProducts : [];
    const activeProduct = prods.find((p) => p?.productId === state.productId);
    const bins = Array.isArray(activeProduct?.bins) ? activeProduct.bins : [];
    const activeBin = bins.find((b) => b?.binId === state.binId);
    const availableStock = activeBin ? activeBin.currentQty : 0;

    if (state.quantityToIssue > availableStock) {
      const err = `Insufficient stock in selected bin (Available: ${availableStock}, Requested: ${state.quantityToIssue})`;
      toast.error(err);
      updateItemState(item.id, { error: err });
      return;
    }

    updateItemState(item.id, { issuing: true, error: null });
    try {
      const payload = {
        productId: state.productId,
        binId: state.binId,
        quantityIssued: Number(state.quantityToIssue),
      };

      await mercIndentService.issueMercItem(indent.id, item.id, payload);
      toast.success(`Material issued for ${item.name}. MERC indent updated.`);

      // Refresh both list and detail query cache
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['merc-indents'] }),
        refetch(),
      ]);

      updateItemState(item.id, { issuing: false, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to issue material';
      toast.error(msg);
      updateItemState(item.id, { issuing: false, error: msg });
    }
  };

  // Helper: Format dimensions string
  const formatDimensions = (item: MercIndentFullDetail['lineItems'][0]) => {
    const parts: string[] = [];
    if (item.material) parts.push(item.material);
    if (item.shape) parts.push(item.shape);
    if (item.diameterMm != null && Number(item.diameterMm) > 0) {
      parts.push(`Ø ${item.diameterMm} mm`);
    } else if (item.lengthMm != null || item.widthMm != null || item.heightMm != null) {
      const l = item.lengthMm ?? '-';
      const w = item.widthMm ?? '-';
      const h = item.heightMm ?? '-';
      parts.push(`${l} × ${w} × ${h} mm`);
    }
    return parts.length > 0 ? parts.join(' | ') : '—';
  };

  // Helper: Status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'ISSUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ISSUED
          </span>
        );
      case 'PARTIAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            PARTIAL
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            PENDING
          </span>
        );
    }
  };

  if (isLoading) {
    return <LoadingState text="Loading MERC indent details and inventory stock..." />;
  }

  if (isError || !indent) {
    return (
      <div className="space-y-4">
        <Button variant="secondary" size="sm" onClick={() => navigate('/governance/merc-indents')}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Indents
        </Button>
        <ErrorState
          message={(error as any)?.message || 'Failed to load MERC indent details'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const lineItemsList = Array.isArray(indent?.lineItems) ? indent.lineItems : [];
  const issuedCount = lineItemsList.filter((i) => i?.status === 'ISSUED').length;
  const totalCount = lineItemsList.length;
  const progressPercent = totalCount > 0 ? Math.round((issuedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/governance/merc-indents"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to MERC Indent List
        </Link>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => refetch()}
          className="flex items-center gap-1.5 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Details
        </Button>
      </div>

      {/* Page Header */}
      <PageHeader
        title={`MERC Indent — ${indent.indentNumber || 'Details'}`}
        subtitle="Inline material issuance and live inventory tracking for production indents"
        actionSlot={renderStatusBadge(indent.status || 'PENDING')}
      />

      {/* Summary Card */}
      <div className="bg-white dark:bg-[#1a1e33] border border-slate-200 dark:border-[#262c4a] rounded-xl p-5 shadow-xs">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" /> Indent No
            </span>
            <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
              {indent.indentNumber}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> PO Number
            </span>
            <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              {indent.poNumber || '—'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5" /> Customer
            </span>
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
              {indent.customerName || '—'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Layout No
            </span>
            <p className="text-sm font-mono font-medium text-slate-700 dark:text-slate-200">
              {indent.layoutNumber || '—'}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Boxes className="w-3.5 h-3.5" /> Issue Progress
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {issuedCount}/{totalCount}
              </span>
              <span className="text-slate-400">({progressPercent}%)</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Line Items To Issue ({lineItemsList.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Select products and storage bins inline to issue materials directly from RM stores.
          </p>
        </div>
      </div>

      {/* Line Items List */}
      <div className="space-y-4">
        {lineItemsList.map((item, idx) => {
          if (!item) return null;
          const isFullyIssued = item.status === 'ISSUED';
          const isRawMat = item.itemType === 'RAW_MATERIAL';
          const form = formStates[item.id] || {
            productId: '',
            binId: '',
            quantityToIssue: 1,
            searchFilter: '',
            isCreateMode: false,
            newProductName: item.name || '',
            newProductDesc: '',
            newProductInitialStock: 0,
            newProductBinId: '',
            creatingProduct: false,
            issuing: false,
            error: null,
          };

          const prods = Array.isArray(item.suggestedProducts) ? item.suggestedProducts : [];
          const activeProduct = prods.find((p) => p?.productId === form.productId);
          const bins = Array.isArray(activeProduct?.bins) ? activeProduct.bins : [];
          const activeBin = bins.find((b) => b?.binId === form.binId);
          const availableBinStock = activeBin ? activeBin.currentQty : 0;
          const remainingToIssue = Math.max(
            0,
            Number(item.quantityRequired) - Number(item.quantityIssued || 0),
          );
          const isInsufficient = form.quantityToIssue > availableBinStock;

          return (
            <div
              key={item.id}
              className={`border rounded-xl transition-all shadow-xs overflow-hidden ${
                isFullyIssued
                  ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1a1e33]'
              }`}
            >
              {/* Card Header: Item info bar */}
              <div className="p-4 bg-slate-50/80 dark:bg-[#141829]/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      {item.name}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide uppercase ${
                          isRawMat
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                        }`}
                      >
                        {isRawMat ? 'RAW MATERIAL' : 'BOUGHT OUT'}
                      </span>
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      MERC Item ID: {item.mercItemId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Dimensions / Spec
                    </span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDimensions(item)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Required
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {item.quantityRequired} {item.unit || ''}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Issued
                    </span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {item.quantityIssued} {item.unit || ''}
                    </span>
                  </div>

                  <div>{renderStatusBadge(item.status)}</div>
                </div>
              </div>

              {/* Card Body: Inline Issue Section */}
              <div className="p-4">
                {isFullyIssued ? (
                  /* Completed Item View */
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-100/50 dark:bg-emerald-950/30 border border-emerald-300/50 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-semibold">
                        This line item has been fully issued ({item.quantityIssued} of{' '}
                        {item.quantityRequired} {item.unit || 'units'}).
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                      ✓ Status: ISSUED
                    </span>
                  </div>
                ) : (
                  /* Pending / Partial Issue Form */
                  <div className="space-y-4">
                    {!form.isCreateMode ? (
                      /* Standard Product & Bin Selector */
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        {/* 1. Product Selector */}
                        <div className="md:col-span-5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                              RM Product * ({prods.length} Products)
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                updateItemState(item.id, { isCreateMode: true, error: null })
                              }
                              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Sparkles className="w-3 h-3" />
                              + New Product (Auto-Create)
                            </button>
                          </div>

                          {/* Instant Search / Filter input */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="🔍 Filter products by name..."
                              value={form.searchFilter || ''}
                              onChange={(e) =>
                                updateItemState(item.id, { searchFilter: e.target.value })
                              }
                              className="w-full px-2.5 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-1"
                            />
                          </div>

                          {(() => {
                            const searchFilter = (form.searchFilter || '').trim().toLowerCase();
                            const allProds = prods;
                            const filtered = searchFilter
                              ? allProds.filter((p) =>
                                  (p?.productName || '').toLowerCase().includes(searchFilter),
                                )
                              : allProds;

                            // Ensure currently selected product stays in list even when filtered
                            const selectedProdInFiltered =
                              form.productId && filtered.some((p) => p?.productId === form.productId);
                            const displayed =
                              selectedProdInFiltered || !form.productId
                                ? filtered
                                : [...filtered, ...allProds.filter((p) => p?.productId === form.productId)];

                            const suggestedMatches = displayed.filter((p) => p?.isSuggested);
                            const otherCatalog = displayed.filter((p) => !p?.isSuggested);

                            return (
                              <select
                                value={form.productId}
                                onChange={(e) =>
                                  handleProductChange(
                                    item.id,
                                    e.target.value,
                                    item.suggestedProducts,
                                    Number(item.quantityRequired),
                                    Number(item.quantityIssued || 0),
                                  )
                                }
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                              >
                                <option value="" disabled>
                                  -- Select Inventory Product ({displayed.length} Available) --
                                </option>

                                {suggestedMatches.length > 0 && (
                                  <optgroup label="⭐ Suggested Matches (Fuzzy Match)">
                                    {suggestedMatches.map((p) => (
                                      <option key={`sug-${p.productId}`} value={p.productId}>
                                        ★ {p.productName} ({p.totalStock > 0 ? `Stock: ${p.totalStock} ${item.unit || 'NOS'}` : 'Stock: 0'})
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                <optgroup label={suggestedMatches.length > 0 ? '📦 All Other Catalog Products' : '📦 All Catalog Products'}>
                                  {(suggestedMatches.length > 0 ? otherCatalog : displayed).map((p) => (
                                    <option key={`all-${p.productId}`} value={p.productId}>
                                      {p.productName} ({p.totalStock > 0 ? `Stock: ${p.totalStock} ${item.unit || 'NOS'}` : 'Stock: 0'})
                                    </option>
                                  ))}
                                </optgroup>

                                <option value="__CREATE_NEW__">➕ Create as New Product...</option>
                              </select>
                            );
                          })()}

                          {/* Live stock indicator for selected product */}
                          {activeProduct && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold pt-0.5">
                              {activeProduct.totalStock > 0 ? (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    Stock: {activeProduct.totalStock} {item.unit || 'NOS'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                                  <span className="text-rose-600 dark:text-rose-400">
                                    Stock: 0 (Out of stock)
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. Bin Selector */}
                        <div className="md:col-span-4 space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Storage Bin *
                          </label>

                          <select
                            value={form.binId}
                            disabled={!form.productId || bins.length === 0}
                            onChange={(e) => {
                              const bin = bins.find((b) => b?.binId === e.target.value);
                              updateItemState(item.id, {
                                binId: e.target.value,
                                quantityToIssue: bin
                                  ? Math.min(
                                      remainingToIssue > 0 ? remainingToIssue : 1,
                                      bin.currentQty || 1,
                                    )
                                  : form.quantityToIssue,
                                error: null,
                              });
                            }}
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                          >
                            <option value="" disabled>
                              {!form.productId
                                ? '-- Select product first --'
                                : bins.length === 0
                                ? '-- No bins with stock --'
                                : '-- Select Bin --'}
                            </option>
                            {bins.map((b) => (
                              <option key={b.binId} value={b.binId}>
                                {b.rackCode} &gt; {b.binCode} ({b.currentQty} available)
                              </option>
                            ))}
                          </select>

                          {/* Bin Stock Badge / Warning */}
                          {activeBin ? (
                            <div className="flex items-center justify-between text-[11px] pt-0.5">
                              <span className="text-slate-500 dark:text-slate-400">
                                Available in bin:
                              </span>
                              <span className="font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                {availableBinStock} {item.unit || 'units'}
                              </span>
                            </div>
                          ) : form.productId && bins.length === 0 ? (
                            <p className="text-[11px] text-rose-500 font-medium">
                              ⚠️ No bins have stock for this product. Use &ldquo;+ New Product&rdquo; to add stock.
                            </p>
                          ) : null}
                        </div>

                        {/* 3. Quantity to Issue */}
                        <div className="md:col-span-3 space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            Qty to Issue *
                          </label>

                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={form.quantityToIssue}
                            onChange={(e) =>
                              updateItemState(item.id, {
                                quantityToIssue: Number(e.target.value),
                                error: null,
                              })
                            }
                            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                          />

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                            Needed: {remainingToIssue} {item.unit || ''}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Inline "Create as New Product" Form */
                      <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-indigo-200 dark:border-indigo-900/50">
                          <h5 className="font-bold text-xs uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            Create Product &amp; Add Initial Stock
                          </h5>
                          <button
                            type="button"
                            onClick={() =>
                              updateItemState(item.id, { isCreateMode: false, error: null })
                            }
                            className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          >
                            Cancel
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Product Name *
                            </label>
                            <input
                              type="text"
                              value={form.newProductName}
                              onChange={(e) =>
                                updateItemState(item.id, { newProductName: e.target.value })
                              }
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="e.g. BRASS HEX ROD 20MM"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Description / Spec
                            </label>
                            <input
                              type="text"
                              value={form.newProductDesc}
                              onChange={(e) =>
                                updateItemState(item.id, { newProductDesc: e.target.value })
                              }
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Specifications or remarks"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Initial Stock Qty
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={form.newProductInitialStock}
                              onChange={(e) =>
                                updateItemState(item.id, {
                                  newProductInitialStock: Number(e.target.value),
                                })
                              }
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                              Target Storage Bin
                            </label>
                            <select
                              value={form.newProductBinId}
                              onChange={(e) =>
                                updateItemState(item.id, { newProductBinId: e.target.value })
                              }
                              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#141829] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                              <option value="">-- Select storage bin --</option>
                              {(Array.isArray(allBins) ? allBins : []).map((bin) => (
                                <option key={bin.id} value={bin.id}>
                                  {bin.rack?.code ? `${bin.rack.code} > ` : ''}
                                  {bin.code} ({bin.name})
                                </option>
                              ))}
                            </select>
                            {loadingBins && (
                              <span className="text-[10px] text-slate-400">Loading bins...</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => updateItemState(item.id, { isCreateMode: false })}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            disabled={form.creatingProduct || !form.newProductName.trim()}
                            onClick={() => handleCreateNewProduct(item.id, item.unit)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 text-xs"
                          >
                            {form.creatingProduct ? 'Creating...' : 'Create Product & Add Stock'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Stock Warning Banner if insufficient */}
                    {isInsufficient && !form.isCreateMode && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300/50 dark:border-amber-800/40 text-amber-800 dark:text-amber-300 text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          ⚠️ Only <strong>{availableBinStock} {item.unit || 'units'}</strong> available in selected bin, but you need <strong>{form.quantityToIssue} {item.unit || 'units'}</strong>.
                        </span>
                      </div>
                    )}

                    {/* Error message display */}
                    {form.error && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-300/50 dark:border-rose-800/40 text-rose-800 dark:text-rose-300 text-xs">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{form.error}</span>
                      </div>
                    )}

                    {/* Full-width Green Issue Button */}
                    {!form.isCreateMode && (
                      <div className="pt-2">
                        <Button
                          disabled={
                            form.issuing ||
                            !form.productId ||
                            !form.binId ||
                            form.quantityToIssue <= 0 ||
                            isInsufficient
                          }
                          onClick={() => handleIssueItem(item)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {form.issuing
                            ? 'Issuing Material...'
                            : `Issue This Item (${form.quantityToIssue} ${item.unit || 'units'})`}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default MercIndentIssueDetail;
