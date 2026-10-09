import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  SlideOver,
  TextInput,
  Select,
} from '../components/ui';
import type { ColumnDef } from '../components/ui';
import { inventoryService } from '../services/inventoryService';
import type { StockBalance, StockTransaction } from '../services/inventoryService';
import type { StockMovementMode } from './StockMovementWorkspace';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export function InventoryStockWorkspace() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlTab = (searchParams.get('tab') || '').toUpperCase();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER'>(
    urlTab === 'MOVEMENTS' || urlTab === 'LEDGER' ? 'LEDGER' : 'OVERVIEW'
  );

  useEffect(() => {
    if (urlTab === 'MOVEMENTS' || urlTab === 'LEDGER') {
      setActiveTab('LEDGER');
    } else if (urlTab === 'OVERVIEW') {
      setActiveTab('OVERVIEW');
    }
  }, [urlTab]);
  
  // Overview Tab State
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [isBalancesLoading, setIsBalancesLoading] = useState(true);
  const [balancesPage, setBalancesPage] = useState(1);
  const [balancesSearch, setBalancesSearch] = useState('');
  
  // SlideOver State for Overview
  const [selectedBalance, setSelectedBalance] = useState<StockBalance | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [balanceTransactions, setBalanceTransactions] = useState<StockTransaction[]>([]);
  const [isBalanceTxLoading, setIsBalanceTxLoading] = useState(false);

  // Ledger Tab State
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');

  const fetchBalances = async () => {
    setIsBalancesLoading(true);
    try {
      const res = await inventoryService.getAllBalances({
        page: balancesPage,
        pageSize: 50,
        search: balancesSearch
      });
      setBalances(res.data);
    } catch {
      toast.error('Failed to load stock balances');
    } finally {
      setIsBalancesLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setIsTransactionsLoading(true);
    try {
      const res = await inventoryService.getAllTransactions({
        page: txPage,
        pageSize: 50,
        transactionType: txTypeFilter || undefined
      });
      setTransactions(res.data);
    } catch {
      toast.error('Failed to load stock transactions');
    } finally {
      setIsTransactionsLoading(false);
    }
  };

  const fetchSelectedBalanceTransactions = async (row: StockBalance) => {
    setIsBalanceTxLoading(true);
    try {
      const res = await inventoryService.getAllTransactions({
        productId: row.productId,
        binId: row.binId,
        page: 1,
        pageSize: 50
      });
      setBalanceTransactions(res.data);
    } catch (err) {
      toast.error('Failed to load transactions for product');
    } finally {
      setIsBalanceTxLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'OVERVIEW') {
      fetchBalances();
    } else {
      fetchTransactions();
    }
  }, [activeTab, balancesPage, balancesSearch, txPage, txTypeFilter]);

  const handleRowClick = async (row: StockBalance) => {
    setSelectedBalance(row);
    setIsSlideOverOpen(true);
    await fetchSelectedBalanceTransactions(row);
  };

  const handleOpenMovement = (mode: StockMovementMode, prodId?: string, binId?: string) => {
    const params = new URLSearchParams({ mode });
    if (prodId) params.set('productId', prodId);
    if (binId) params.set('binId', binId);
    navigate(`/inventory/movements?${params.toString()}`);
  };

  const overviewColumns: ColumnDef<StockBalance>[] = [
    { key: 'productCode', header: 'Code', render: (r) => r.productCode || 'N/A' },
    { key: 'productName', header: 'Product Name', render: (r) => r.productName || 'N/A' },
    { key: 'binCode', header: 'Bin', render: (r) => r.binCode || 'N/A' },
    { key: 'warehouseName', header: 'Warehouse', render: (r) => r.warehouseName || 'N/A' },
    { key: 'latestLotBatchNumber', header: 'Lot/Batch', render: (r) => r.latestLotBatchNumber || 'N/A' },
    { key: 'currentQuantity', header: 'Qty', isNumeric: true, render: (r) => `${r.currentQuantity} ${r.uom || ''}` },
    { key: 'msl', header: 'MSL', isNumeric: true, render: (r) => r.msl ?? 'N/A' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r) => {
        if (r.msl === undefined || r.msl === null) return <StatusBadge status="OK" />;
        const diff = Number(r.currentQuantity) - Number(r.msl);
        if (diff < 0) return <StatusBadge status="CRITICAL" />;
        if (diff <= 5) return <StatusBadge status="LOW" />;
        return <StatusBadge status="OK" />;
      } 
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            title="Stock In to this Bin"
            onClick={() => handleOpenMovement('STOCK_IN', r.productId, r.binId)}
            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Stock Out from this Bin"
            onClick={() => handleOpenMovement('STOCK_OUT', r.productId, r.binId)}
            className="p-1 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors"
          >
            <ArrowUpFromLine className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Adjust Stock in this Bin"
            onClick={() => handleOpenMovement('ADJUST', r.productId, r.binId)}
            className="p-1 rounded text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const txColumns: ColumnDef<StockTransaction>[] = [
    { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
    { key: 'product', header: 'Product', render: (r) => r.product?.name || 'N/A' },
    { key: 'bin', header: 'Bin', render: (r) => {
        if (r.sourceBin && r.destinationBin) return `${r.sourceBin.code} → ${r.destinationBin.code}`;
        if (r.sourceBin) return r.sourceBin.code;
        if (r.destinationBin) return r.destinationBin.code;
        return 'N/A';
    }},
    { key: 'transactionType', header: 'Type', render: (r) => <StatusBadge status={r.transactionType} /> },
    { 
      key: 'quantity', 
      header: 'Qty', 
      isNumeric: true,
      render: (r) => {
        const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || r.transactionType === 'GRN_RECEIPT' || r.transactionType === 'DC_RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
        const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || r.transactionType === 'DC_DISPATCH' || r.transactionType === 'PRODUCTION_CONSUMPTION' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
        const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
        const sign = isAddition ? '+' : isSubtraction ? '-' : '';
        return <span className={`font-medium ${color}`}>{sign}{r.quantity}</span>;
      }
    },
    { key: 'lotBatchNumber', header: 'Lot/Batch', render: (r) => r.lotBatchNumber || 'N/A' },
    { key: 'cost', header: 'Cost', isNumeric: true, render: (r) => r.cost != null ? `$${Number(r.cost).toFixed(2)}` : 'N/A' },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || 'N/A' },
    { key: 'createdBy', header: 'Created By', render: (r) => r.createdBy?.name || 'System' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Overview & Ledger"
        subtitle="View current inventory balances, manage physical movements, and audit transactions"
        breadcrumbs={<span>Inventory / Stock Overview</span>}
        actionSlot={
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_IN')}
              className="inline-flex items-center px-3 py-1.5 border border-emerald-300 text-xs font-medium rounded-md text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors shadow-sm"
            >
              <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Stock In
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('STOCK_OUT')}
              className="inline-flex items-center px-3 py-1.5 border border-rose-300 text-xs font-medium rounded-md text-rose-800 bg-rose-50 hover:bg-rose-100 transition-colors shadow-sm"
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              Stock Out
            </button>
            <button
              type="button"
              onClick={() => handleOpenMovement('ADJUST')}
              className="inline-flex items-center px-3 py-1.5 border border-blue-300 text-xs font-medium rounded-md text-blue-800 bg-blue-50 hover:bg-blue-100 transition-colors shadow-sm"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
              Adjust
            </button>
          </div>
        }
      />

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'OVERVIEW'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === 'LEDGER'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            Movements
          </button>
        </nav>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div className="w-1/3">
              <TextInput
                placeholder="Search products or bins..."
                value={balancesSearch}
                onChange={(e) => { setBalancesSearch(e.target.value); setBalancesPage(1); }}
              />
            </div>
          </div>
          <DataTable
            data={balances}
            columns={overviewColumns}
            isLoading={isBalancesLoading}
            pagination
            defaultPageSize={10}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div className="w-1/4">
              <Select
                value={txTypeFilter}
                onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
              >
                <option value="">All Transactions</option>
                <option value="STOCK_IN">Stock In</option>
                <option value="STOCK_OUT">Stock Out</option>
                <option value="STORES_ISSUE">Stores Issue</option>
                <option value="RETURN">Return</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="TRANSFER">Transfer</option>
                <option value="GRN_RECEIPT">GRN Receipt</option>
                <option value="DC_DISPATCH">DC Dispatch</option>
                <option value="DC_RETURN">DC Return</option>
                <option value="PRODUCTION_CONSUMPTION">Production Consumption</option>
              </Select>
            </div>
          </div>
          <DataTable
            data={transactions}
            columns={txColumns}
            isLoading={isTransactionsLoading}
            pagination
            defaultPageSize={10}
          />
        </div>
      )}

      <SlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        title={selectedBalance ? `History: ${selectedBalance.productName}` : 'Transaction History'}
      >
        <div className="space-y-6">
          {selectedBalance && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Bin</p>
                  <p className="font-medium">{selectedBalance.binCode}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Warehouse</p>
                  <p className="font-medium">{selectedBalance.warehouseName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Qty</p>
                  <p className="font-medium">{selectedBalance.currentQuantity} {selectedBalance.uom}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">MSL</p>
                  <p className="font-medium">{selectedBalance.msl ?? 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Latest Lot/Batch</p>
                  <p className="font-medium">{selectedBalance.latestLotBatchNumber || 'N/A'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Transactions</h4>
            <DataTable
              data={balanceTransactions}
              columns={[
                { key: 'createdAt', header: 'Date', render: (r) => new Date(r.createdAt).toLocaleString() },
                { key: 'transactionType', header: 'Type', render: (r) => <StatusBadge status={r.transactionType} /> },
                { 
                  key: 'quantity', 
                  header: 'Qty',
                  isNumeric: true,
                  render: (r) => {
                    const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || r.transactionType === 'GRN_RECEIPT' || r.transactionType === 'DC_RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
                    const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || r.transactionType === 'DC_DISPATCH' || r.transactionType === 'PRODUCTION_CONSUMPTION' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
                    const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
                    const sign = isAddition ? '+' : isSubtraction ? '-' : '';
                    return <span className={`font-medium ${color}`}>{sign}{r.quantity}</span>;
                  }
                },
                { key: 'lotBatchNumber', header: 'Lot/Batch', render: (r) => r.lotBatchNumber || 'N/A' }
              ]}
              isLoading={isBalanceTxLoading}
            />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
