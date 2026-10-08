import React, { useState, useEffect } from 'react';
import {
  PageHeader,
  DataTable,
  StatusBadge,
  SlideOver,
  TextInput,
  Select,
} from '../components/ui';
import type { ColumnDef } from '../components/ui';
import { inventoryService, StockBalance, StockTransaction } from '../services/inventoryService';
import { Box, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

export function InventoryStockWorkspace() {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LEDGER'>('OVERVIEW');
  
  // Overview Tab State
  const [balances, setBalances] = useState<StockBalance[]>([]);
  const [totalBalances, setTotalBalances] = useState(0);
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
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [txPage, setTxPage] = useState(1);
  const [txTypeFilter, setTxTypeFilter] = useState('');

  const fetchBalances = async () => {
    setIsBalancesLoading(true);
    try {
      const res = await inventoryService.getAllBalances({
        page: balancesPage,
        pageSize: 10,
        search: balancesSearch
      });
      setBalances(res.data);
      setTotalBalances(res.total);
    } catch (err) {
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
        pageSize: 10,
        transactionType: txTypeFilter || undefined
      });
      setTransactions(res.data);
      setTotalTransactions(res.total);
    } catch (err) {
      toast.error('Failed to load stock transactions');
    } finally {
      setIsTransactionsLoading(false);
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

  const overviewColumns: ColumnDef<StockBalance>[] = [
    { key: 'productCode', header: 'Code', render: (r) => r.productCode || 'N/A' },
    { key: 'productName', header: 'Product Name', render: (r) => r.productName || 'N/A' },
    { key: 'binCode', header: 'Bin', render: (r) => r.binCode || 'N/A' },
    { key: 'warehouseName', header: 'Warehouse', render: (r) => r.warehouseName || 'N/A' },
    { key: 'currentQuantity', header: 'Qty', isNumeric: true, render: (r) => `${r.currentQuantity} ${r.uom || ''}` },
    { key: 'msl', header: 'MSL', isNumeric: true, render: (r) => r.msl ?? 'N/A' },
    { 
      key: 'status', 
      header: 'Status', 
      render: (r) => {
        if (r.msl === undefined || r.msl === null) return <StatusBadge status="OK" />;
        const diff = Number(r.currentQuantity) - Number(r.msl);
        if (diff < 0) return <StatusBadge status="CRITICAL" />;
        if (diff <= 5) return <StatusBadge status="LOW" />; // Just an example threshold
        return <StatusBadge status="OK" />;
      } 
    },
  ];

  const txColumns: ColumnDef<StockTransaction>[] = [
    { key: 'createdAt', header: 'Date', render: (r) => format(new Date(r.createdAt), 'dd MMM yyyy HH:mm') },
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
        const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
        const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
        const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
        const sign = isAddition ? '+' : isSubtraction ? '-' : '';
        return <span className={`font-medium ${color}`}>{sign}{r.quantity}</span>;
      }
    },
    { key: 'reason', header: 'Reason', render: (r) => r.reason || 'N/A' },
    { key: 'createdBy', header: 'Created By', render: (r) => r.createdBy?.name || 'System' }
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Stock Overview & Ledger"
        subtitle="View current inventory balances and transaction history"
        breadcrumbs={<span>Inventory / Stock Overview</span>}
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
            Ledger
          </button>
        </nav>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div className="w-1/3">
              <TextInput
                label=""
                placeholder="Search products or bins..."
                icon={<Search className="w-4 h-4" />}
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
            page={balancesPage}
            totalItems={totalBalances}
            onPageChange={setBalancesPage}
            onRowClick={handleRowClick}
          />
        </div>
      )}

      {activeTab === 'LEDGER' && (
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <div className="w-1/4">
              <Select
                label=""
                value={txTypeFilter}
                onChange={(e) => { setTxTypeFilter(e.target.value); setTxPage(1); }}
                options={[
                  { value: '', label: 'All Transactions' },
                  { value: 'STOCK_IN', label: 'Stock In' },
                  { value: 'STOCK_OUT', label: 'Stock Out' },
                  { value: 'STORES_ISSUE', label: 'Stores Issue' },
                  { value: 'RETURN', label: 'Return' },
                  { value: 'ADJUSTMENT', label: 'Adjustment' },
                  { value: 'TRANSFER', label: 'Transfer' },
                ]}
              />
            </div>
          </div>
          <DataTable
            data={transactions}
            columns={txColumns}
            isLoading={isTransactionsLoading}
            pagination
            page={txPage}
            totalItems={totalTransactions}
            onPageChange={setTxPage}
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
              </div>
            </div>
          )}

          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Recent Transactions</h4>
            <DataTable
              data={balanceTransactions}
              columns={[
                { key: 'createdAt', header: 'Date', render: (r) => format(new Date(r.createdAt), 'dd MMM yyyy HH:mm') },
                { key: 'transactionType', header: 'Type', render: (r) => <StatusBadge status={r.transactionType} /> },
                { 
                  key: 'quantity', 
                  header: 'Qty',
                  isNumeric: true,
                  render: (r) => {
                    const isAddition = r.transactionType === 'STOCK_IN' || r.transactionType === 'RETURN' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'INCREASE');
                    const isSubtraction = r.transactionType === 'STOCK_OUT' || r.transactionType === 'STORES_ISSUE' || (r.transactionType === 'ADJUSTMENT' && r.adjustmentDirection === 'DECREASE');
                    const color = isAddition ? 'text-green-600' : isSubtraction ? 'text-red-600' : 'text-gray-900';
                    const sign = isAddition ? '+' : isSubtraction ? '-' : '';
                    return <span className={`font-medium ${color}`}>{sign}{r.quantity}</span>;
                  }
                }
              ]}
              isLoading={isBalanceTxLoading}
            />
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
