import React, { useEffect, useState, useMemo } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { APP_CONFIG } from '../app/config';
import { CreateInventoryItemModal } from './components/CreateInventoryItemModal';

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

export const InventoryPage: React.FC<{
  currentView: string;
  onNavigate: (view: any) => void;
}> = ({ currentView, onNavigate }) => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'LOW'>('ALL');

  const fetchInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch inventory');
      const data = await response.json();
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchInventory();
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const currentQty = item.stockBalance?.currentQuantity || 0;
      const isLowStock = currentQty < item.minimumStockLevel;

      if (statusFilter === 'LOW' && !isLowStock) return false;
      if (statusFilter === 'NORMAL' && isLowStock) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          item.material.toLowerCase().includes(term) ||
          item.materialType.toLowerCase().includes(term) ||
          item.grade.toLowerCase().includes(term) ||
          item.size.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [items, searchTerm, statusFilter]);

  return (
    <AppLayout activeNav={currentView} onNavigate={onNavigate}>
      <div className="page-container p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Inventory Foundation</h1>
            <p className="text-gray-600">Material stock and minimum levels (Phase 9)</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateModalOpen(true)} variant="primary">
              + Add Item
            </Button>
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

        <Card className="mb-6">
          <div className="flex gap-4 p-4 border-b border-gray-100 bg-gray-50">
            <input
              type="text"
              placeholder="Search material, grade, size..."
              className="form-input flex-1"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            <select
              className="form-select w-48"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
            >
              <option value="ALL">All Status</option>
              <option value="NORMAL">Normal Stock</option>
              <option value="LOW">Low Stock</option>
            </select>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      Loading inventory data...
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No inventory items found.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => {
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
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {isCreateModalOpen && (
          <CreateInventoryItemModal
            onClose={() => setIsCreateModalOpen(false)}
            onSuccess={handleCreateSuccess}
          />
        )}
      </div>
    </AppLayout>
  );
};
