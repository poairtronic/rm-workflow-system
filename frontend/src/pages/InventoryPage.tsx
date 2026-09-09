import React, { useEffect, useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { APP_CONFIG } from '../app/config';
import { CreateInventoryItemModal } from './components/CreateInventoryItemModal';
import { StockInModal } from './components/StockInModal';
import { StockOutModal } from './components/StockOutModal';
import { StockAdjustmentModal } from './components/StockAdjustmentModal';
import { TransactionHistoryModal } from './components/TransactionHistoryModal';
import { useAuth } from '../hooks/useAuth';

interface InventoryItem {
  id: string;
  material: string;
  materialType: string;
  grade: string;
  size: string;
  unit: string;
  minimumStockLevel: number;
  isActive: boolean;
  stockBalance?: {
    currentQuantity: number;
  };
}

interface ReconciliationResult {
  inventoryItemId: string;
  material: string;
  grade: string;
  size: string;
  currentBalance: number;
  ledgerMovement: number;
  openingBalance: number | null;
  expectedBalance: number | null;
  difference: number | null;
  status: 'MATCH' | 'MISMATCH' | 'NOT_RECONCILABLE';
  reason?: string;
}

export const InventoryPage: React.FC<{
  currentView: string;
  onNavigate: (view: any) => void;
}> = ({ currentView, onNavigate }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [stockInItem, setStockInItem] = useState<InventoryItem | null>(null);
  const [stockOutItem, setStockOutItem] = useState<InventoryItem | null>(null);
  const [adjustmentItem, setAdjustmentItem] = useState<InventoryItem | null>(null);
  
  const [activeTab, setActiveTab] = useState<'STOCK' | 'RECONCILIATION'>('STOCK');
  const [reconData, setReconData] = useState<ReconciliationResult[]>([]);
  const [reconLoading, setReconLoading] = useState(false);
  
  const { role } = useAuth();

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'LOW'>('ALL');

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
      });
      
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }
      
      if (statusFilter === 'LOW') {
        queryParams.append('stockStatus', 'LOW_STOCK');
      } else if (statusFilter === 'NORMAL') {
        queryParams.append('stockStatus', 'NORMAL');
      }

      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setItems(data.data);
      setTotalPages(data.totalPages);
      setTotalRecords(data.total);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const fetchReconciliation = async () => {
    setReconLoading(true);
    setError(null);
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory/reconciliation`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch reconciliation data');
      const data = await response.json();
      setReconData(data);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setReconLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchInventory();
  };

  const handleStockInSuccess = () => {
    setStockInItem(null);
    fetchInventory();
  };

  const handleStockOutSuccess = () => {
    setStockOutItem(null);
    fetchInventory();
  };

  const handleAdjustmentSuccess = () => {
    setAdjustmentItem(null);
    fetchInventory();
  };

  useEffect(() => {
    if (activeTab === 'STOCK') {
      fetchInventory();
    }
  }, [activeTab, page]);

  const handleFilterChange = (newStatus: any) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    fetchInventory();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setPage(1);
  };

  // Re-fetch when statusFilter resets (if page didn't change)
  useEffect(() => {
    if (activeTab === 'STOCK' && page === 1) {
      fetchInventory();
    }
  }, [statusFilter]);

  useEffect(() => {
    if (activeTab === 'RECONCILIATION') {
      fetchReconciliation();
    }
  }, [activeTab]);

  return (
    <AppLayout activeNav={currentView} onNavigate={onNavigate}>
      {isCreateModalOpen && <CreateInventoryItemModal onClose={() => setIsCreateModalOpen(false)} onSuccess={handleCreateSuccess} />}
      {stockInItem && <StockInModal item={stockInItem} onClose={() => setStockInItem(null)} onSuccess={handleStockInSuccess} />}
      {stockOutItem && <StockOutModal item={stockOutItem} onClose={() => setStockOutItem(null)} onSuccess={handleStockOutSuccess} />}
      {adjustmentItem && <StockAdjustmentModal item={adjustmentItem} onClose={() => setAdjustmentItem(null)} onSuccess={handleAdjustmentSuccess} />}
      {isHistoryModalOpen && <TransactionHistoryModal onClose={() => { setIsHistoryModalOpen(false); setSelectedItem(null); }} item={selectedItem} />}

      <div className="page-container p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Inventory Foundation</h1>
            <p className="text-gray-600">Material stock and minimum levels (Phase 9)</p>
          </div>
          <div className="flex gap-2">
            {(role === 'STORES' || role === 'ADMIN') && (
              <Button onClick={() => setIsCreateModalOpen(true)} variant="primary">
                + Add Item
              </Button>
            )}
            <Button onClick={fetchInventory} disabled={loading} variant="secondary">
              ↻ Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('STOCK')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'STOCK'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Stock Items
            </button>
            <button
              onClick={() => setActiveTab('RECONCILIATION')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'RECONCILIATION'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reconciliation
            </button>
          </nav>
        </div>

        {activeTab === 'STOCK' && (
          <Card className="mb-6">
          <div className="p-4 border-b border-gray-100 bg-gray-50">
            <form onSubmit={handleSearchSubmit} className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search material, grade, size... (Press Enter)"
                className="form-input flex-1"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select
                className="form-select w-48"
                value={statusFilter}
                onChange={e => handleFilterChange(e.target.value)}
              >
                <option value="ALL">All Status</option>
                <option value="NORMAL">Normal Stock</option>
                <option value="LOW">Low Stock</option>
              </select>
              <Button type="submit" variant="primary">Search</Button>
              <Button type="button" onClick={handleResetFilters} variant="secondary">Reset</Button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-sm uppercase tracking-wider text-gray-700">
                  <th className="p-4 border-b font-semibold">Material</th>
                  <th className="p-4 border-b font-semibold">Type/Grade</th>
                  <th className="p-4 border-b font-semibold">Size</th>
                  <th className="p-4 border-b font-semibold text-right">Available</th>
                  <th className="p-4 border-b font-semibold">Unit</th>
                  <th className="p-4 border-b font-semibold text-right">Minimum</th>
                  <th className="p-4 border-b font-semibold">Status</th>
                  <th className="p-4 border-b font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      Loading inventory data...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const currentQty = item.stockBalance?.currentQuantity ?? 0;
                    const isLow = currentQty < item.minimumStockLevel;
                    return (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium">{item.material}</td>
                        <td className="p-4">{item.materialType} / {item.grade}</td>
                        <td className="p-4">{item.size}</td>
                        <td className={`p-4 text-right font-mono font-bold ${isLow ? 'text-red-600' : ''}`}>
                          {Number(currentQty).toFixed(3)}
                        </td>
                        <td className="p-4 text-gray-600">{item.unit}</td>
                        <td className="p-4 text-right font-mono text-gray-600">
                          {Number(item.minimumStockLevel).toFixed(3)}
                        </td>
                        <td className="p-4">
                          {isLow ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              Normal
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <div className="flex justify-end gap-1">
                            <Button 
                              onClick={() => { setSelectedItem(item); setIsHistoryModalOpen(true); }} 
                              variant="secondary" 
                              className="text-xs px-2 py-1"
                            >
                              History
                            </Button>
                            {(role === 'STORES' || role === 'ADMIN') && (
                              <>
                                <Button 
                                  onClick={() => setStockInItem(item)} 
                                  variant="secondary" 
                                  className="text-xs px-2 py-1"
                                >
                                  In
                                </Button>
                                <Button 
                                  onClick={() => setStockOutItem(item)} 
                                  variant="secondary" 
                                  className="text-xs px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                >
                                  Out
                                </Button>
                                <Button 
                                  onClick={() => setAdjustmentItem(item)} 
                                  variant="secondary" 
                                  className="text-xs px-2 py-1 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 border-yellow-200"
                                >
                                  Adjust
                                </Button>
                              </>
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
          
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Showing page {page} of {totalPages} ({totalRecords} records total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </Card>
        )}

        {activeTab === 'RECONCILIATION' && (
          <Card className="mb-6">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">Ledger vs Balance Reconciliation</h2>
              <Button onClick={fetchReconciliation} disabled={reconLoading} variant="secondary">
                ↻ Re-run
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-sm uppercase tracking-wider text-gray-700">
                    <th className="p-4 border-b font-semibold">Material</th>
                    <th className="p-4 border-b font-semibold">Grade / Size</th>
                    <th className="p-4 border-b font-semibold text-right">Current Bal</th>
                    <th className="p-4 border-b font-semibold text-right">Opening Bal</th>
                    <th className="p-4 border-b font-semibold text-right">Ledger Mvmt</th>
                    <th className="p-4 border-b font-semibold text-right">Expected Bal</th>
                    <th className="p-4 border-b font-semibold text-right">Diff</th>
                    <th className="p-4 border-b font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reconLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        Running reconciliation...
                      </td>
                    </tr>
                  ) : reconData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-gray-500">
                        No reconciliation data available.
                      </td>
                    </tr>
                  ) : (
                    reconData.map(result => (
                      <tr key={result.inventoryItemId} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium">{result.material}</td>
                        <td className="p-4">{result.grade} / {result.size}</td>
                        <td className="p-4 text-right font-mono font-bold">
                          {result.currentBalance.toFixed(3)}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-500">
                          {result.openingBalance !== null ? result.openingBalance.toFixed(3) : '-'}
                        </td>
                        <td className="p-4 text-right font-mono text-gray-600">
                          {result.ledgerMovement > 0 ? '+' : ''}{result.ledgerMovement.toFixed(3)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-gray-800">
                          {result.expectedBalance !== null ? result.expectedBalance.toFixed(3) : '-'}
                        </td>
                        <td className={`p-4 text-right font-mono font-bold ${
                          result.difference === 0 ? 'text-gray-400' : 'text-red-600'
                        }`}>
                          {result.difference !== null ? result.difference.toFixed(3) : '-'}
                        </td>
                        <td className="p-4">
                          {result.status === 'MATCH' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                              MATCH
                            </span>
                          )}
                          {result.status === 'MISMATCH' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                              MISMATCH
                            </span>
                          )}
                          {result.status === 'NOT_RECONCILABLE' && (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex w-fit items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                                NOT RECONCILABLE
                              </span>
                              <span className="text-xs text-gray-500">{result.reason}</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {isCreateModalOpen && (
          <CreateInventoryItemModal
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        )}

        {stockInItem && (
          <StockInModal
            item={stockInItem}
            onClose={() => setStockInItem(null)}
            onSuccess={handleStockInSuccess}
          />
        )}

        {stockOutItem && (
          <StockOutModal
            item={stockOutItem}
            onClose={() => setStockOutItem(null)}
            onSuccess={handleStockOutSuccess}
          />
        )}

        {adjustmentItem && (
          <StockAdjustmentModal
            item={adjustmentItem}
            onClose={() => setAdjustmentItem(null)}
            onSuccess={handleAdjustmentSuccess}
          />
        )}
      </div>
    </AppLayout>
  );
};
