import { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle, 
  Package, 
  Boxes, 
  FileText, 
  Check, 
  Layers, 
  Clock, 
  Warehouse,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { workflowService } from '../services/workflowService';
import { inventoryService, type ProductBinBalance } from '../services/inventoryService';
import { ProductSelect } from '../components/inventory/ProductSelect';

interface ReviewMappingWorkspaceProps {
  scId: string;
  scNumber: string;
  poNumber: string;
  productName: string;
  rmId?: string;
  onBack: () => void;
  onSuccess: () => void;
  onProceedToIssue?: (scId: string, scNumber: string) => void;
}

interface ReviewItemState {
  rmItemId: string;
  material: string;
  grade: string;
  size: string;
  materialType?: string;
  quantity: number;
  mappedProductId: string;
  mappedProductName?: string;
  mappedProductCode?: string;
  balances: ProductBinBalance[];
  totalAvailable: number;
  loadingBalances?: boolean;
}

export function ReviewMappingWorkspace({
  scId,
  scNumber,
  poNumber,
  productName,
  rmId: initialRmId,
  onBack,
  onSuccess,
  onProceedToIssue,
}: ReviewMappingWorkspaceProps) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const [activeRmId, setActiveRmId] = useState<string>(initialRmId || '');
  const [rmStatus, setRmStatus] = useState<string>('SUBMITTED');
  const [items, setItems] = useState<ReviewItemState[]>([]);
  const [remarks, setRemarks] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rmRes = await workflowService.getRmList(scId);
      if (!rmRes || rmRes.length === 0) {
        throw new Error('No RM requisition found for this Sales Order Component.');
      }

      const rm = rmRes[0];
      setActiveRmId(rm.id);
      setRmStatus(rm.status || 'SUBMITTED');

      const rawItems = rm.items || [];
      if (rawItems.length === 0) {
        throw new Error('This RM requisition does not contain any requested items.');
      }

      // Fetch balances for each item that has mappedProductId
      const initializedItems: ReviewItemState[] = await Promise.all(
        rawItems.map(async (item: any) => {
          const productId = item.mappedProductId || '';
          let balances: ProductBinBalance[] = [];
          let totalAvailable = 0;

          if (productId) {
            try {
              balances = await inventoryService.getBalancesByProduct(productId);
              totalAvailable = balances.reduce((sum, b) => sum + Number(b.currentQuantity || 0), 0);
            } catch (err) {
              console.error('Failed to load stock balance for product', productId, err);
            }
          }

          return {
            rmItemId: item.id,
            material: item.material || item.name || 'Raw Material',
            grade: item.grade || 'Standard',
            size: item.size || 'N/A',
            materialType: item.materialType || 'ROUND_BAR',
            quantity: Number(item.quantity || 0),
            mappedProductId: productId,
            mappedProductName: item.material,
            balances,
            totalAvailable,
            loadingBalances: false,
          };
        })
      );

      setItems(initializedItems);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to load RM details.');
    } finally {
      setLoading(false);
    }
  }, [scId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleProductChange = async (itemIdx: number, newProductId: string, productObj?: any) => {
    const updated = [...items];
    const targetItem = { ...updated[itemIdx] };
    targetItem.mappedProductId = newProductId;
    targetItem.mappedProductName = productObj?.name || targetItem.material;
    targetItem.mappedProductCode = productObj?.code || '';
    targetItem.loadingBalances = true;
    updated[itemIdx] = targetItem;
    setItems(updated);

    let balances: ProductBinBalance[] = [];
    let totalAvailable = 0;

    if (newProductId) {
      try {
        balances = await inventoryService.getBalancesByProduct(newProductId);
        totalAvailable = balances.reduce((sum, b) => sum + Number(b.currentQuantity || 0), 0);
      } catch (err) {
        console.error('Failed to fetch product balance', err);
      }
    }

    targetItem.balances = balances;
    targetItem.totalAvailable = totalAvailable;
    targetItem.loadingBalances = false;
    updated[itemIdx] = { ...targetItem };
    setItems([...updated]);
  };

  const handleApprove = async () => {
    if (!activeRmId) {
      setError('RM Requisition ID is missing.');
      return;
    }

    // Validate that all items have a mapped product
    const unmapped = items.filter((it) => !it.mappedProductId);
    if (unmapped.length > 0) {
      setError(`Please map all ${items.length} items to an active inventory product before approving.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const itemMappings = items.map((it) => ({
        rmItemId: it.rmItemId,
        productId: it.mappedProductId,
      }));

      await workflowService.reviewRm(activeRmId, itemMappings, remarks.trim() || undefined);

      setReviewSuccess(true);
      setRmStatus('REVIEWED');
      onSuccess();
    } catch (err: any) {
      console.error('Review approval error', err);
      setError(err.response?.data?.message || err.message || 'Failed to approve RM mapping.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to RM Issue Queue
        </button>

        <div className="flex items-center space-x-2">
          {rmStatus === 'SUBMITTED' ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Pending Review
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <Check className="w-3.5 h-3.5 mr-1" />
              Reviewed & Ready to Issue
            </span>
          )}
        </div>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-slate-900">Review RM Mapping</h1>
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                Stores Review
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Verify raw material specifications, confirm inventory product catalog mapping, and verify available warehouse stock.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              disabled={submitting}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              {reviewSuccess ? 'Close' : 'Cancel'}
            </button>

            {!reviewSuccess ? (
              <button
                onClick={handleApprove}
                disabled={submitting || loading || items.length === 0}
                className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve & Mark as Reviewed</span>
                  </>
                )}
              </button>
            ) : (
              onProceedToIssue && (
                <button
                  onClick={() => onProceedToIssue(scId, scNumber)}
                  className="flex items-center space-x-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Proceed to Issue Material</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              )
            )}
          </div>
        </div>

        {/* PO & SC Metadata Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Purchase Order</div>
            <div className="text-base font-semibold text-slate-900 mt-0.5">{poNumber}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Component (SC)</div>
            <div className="text-base font-semibold text-slate-900 mt-0.5">{scNumber}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Target Product</div>
            <div className="text-base font-semibold text-slate-900 mt-0.5 truncate">{productName}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-xs font-medium text-slate-500">Requested Items</div>
            <div className="text-base font-semibold text-indigo-600 mt-0.5">{items.length} Material(s)</div>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {reviewSuccess && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-emerald-900 text-base">RM Mapping Successfully Reviewed & Approved!</h4>
              <p className="text-sm text-emerald-700">
                The Raw Material Requisition for SC <strong>{scNumber}</strong> is now confirmed. You can immediately issue the required stock from designated warehouse bins.
              </p>
            </div>
          </div>
          {onProceedToIssue && (
            <button
              onClick={() => onProceedToIssue(scId, scNumber)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm shrink-0 flex items-center space-x-2"
            >
              <span>Issue Material Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Loading Spinner */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading requested materials and inventory stock balances...</p>
        </div>
      ) : (
        /* Materials & Product Mapping Card */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/75 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Boxes className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Raw Material Items & Product Catalog Mapping
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Ensure each BOM item is mapped to the correct inventory stock item
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item, idx) => {
              const hasSufficient = item.totalAvailable >= item.quantity;
              const hasPartial = item.totalAvailable > 0 && item.totalAvailable < item.quantity;

              return (
                <div key={item.rmItemId} className="p-6 hover:bg-slate-50/50 transition-colors">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Item Information from Designer */}
                    <div className="lg:col-span-4 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <h4 className="font-bold text-slate-900 text-base leading-tight">
                          {item.material}
                        </h4>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1 pl-8">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Layers className="w-3 h-3 mr-1 text-slate-400" />
                          Grade: {item.grade}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Size: {item.size}
                        </span>
                        {item.materialType && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {item.materialType}
                          </span>
                        )}
                      </div>

                      <div className="pl-8 pt-2">
                        <div className="text-xs font-medium text-slate-500">Requested Quantity</div>
                        <div className="text-lg font-bold text-slate-900">
                          {item.quantity.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-slate-500">units</span>
                        </div>
                      </div>
                    </div>

                    {/* Mapped Inventory Product Selector */}
                    <div className="lg:col-span-4 space-y-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Mapped Inventory Product <span className="text-red-500">*</span>
                      </label>

                      <ProductSelect
                        value={item.mappedProductId}
                        onChange={(prodId, prodObj) => handleProductChange(idx, prodId, prodObj)}
                        placeholder="Search product catalog..."
                        disabled={reviewSuccess || submitting}
                        className="w-full"
                      />

                      <p className="text-xs text-slate-500">
                        Select or verify the exact inventory stock code for this material item.
                      </p>
                    </div>

                    {/* Live Stock Balance Snapshot */}
                    <div className="lg:col-span-4 bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1">
                          <Warehouse className="w-3.5 h-3.5 text-slate-400 mr-1" />
                          Warehouse Stock
                        </span>

                        {item.loadingBalances ? (
                          <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        ) : !item.mappedProductId ? (
                          <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 rounded">
                            Unmapped
                          </span>
                        ) : hasSufficient ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Sufficient Stock
                          </span>
                        ) : hasPartial ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Partial Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Out of Stock
                          </span>
                        )}
                      </div>

                      <div className="mt-2">
                        <div className="text-xs text-slate-500">Available across all bins:</div>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">
                          {item.mappedProductId ? (
                            <>
                              {item.totalAvailable.toLocaleString()}{' '}
                              <span className="text-xs font-medium text-slate-500">
                                in stock (Requires {item.quantity})
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-normal text-slate-400">Map product to view stock</span>
                          )}
                        </div>
                      </div>

                      {/* Bin Details */}
                      {item.mappedProductId && item.balances.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                          <div className="text-xs font-medium text-slate-600">Bin Breakdown:</div>
                          <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                            {item.balances.map((b) => (
                              <div
                                key={b.id || b.binId}
                                className="flex justify-between items-center text-xs bg-white px-2 py-1 rounded border border-slate-100"
                              >
                                <span className="font-mono text-slate-700 truncate max-w-[120px]">
                                  {b.binCode || 'Bin'} {b.warehouseName ? `(${b.warehouseName})` : ''}
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {Number(b.currentQuantity).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Review Remarks Footer */}
          <div className="p-6 bg-slate-50 border-t border-slate-200">
            <div className="max-w-2xl space-y-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>Stores Review Remarks (Optional)</span>
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={reviewSuccess || submitting}
                placeholder="Enter review notes, verification findings, or special batch requirements..."
                rows={2}
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Workflow Guidance Box */}
      <div className="bg-indigo-50/60 rounded-xl border border-indigo-100 p-5">
        <h4 className="text-sm font-bold text-indigo-900 flex items-center space-x-2">
          <Package className="w-4 h-4 text-indigo-600" />
          <span>Understanding the Stores Review & Stock Issue Sequence</span>
        </h4>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-indigo-800">
          <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
            <span className="font-bold block text-indigo-900 mb-1">Step 1: Requisition Review</span>
            Design submitted the Bill of Materials. Stores or Admin reviews the item specifications and maps them to inventory catalog products.
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
            <span className="font-bold block text-indigo-900 mb-1">Step 2: Approve Mapping</span>
            Clicking <strong>Approve & Mark as Reviewed</strong> records the product links, snapshots stock levels, and updates SC status to <em>Ready to Issue</em>.
          </div>
          <div className="bg-white/80 p-3 rounded-lg border border-indigo-100">
            <span className="font-bold block text-indigo-900 mb-1">Step 3: Issue Material</span>
            Once reviewed, the <strong>Issue Material</strong> action is unlocked. Stores allocates specific bins and lot/batch numbers to release material to Production.
          </div>
        </div>
      </div>
    </div>
  );
}

