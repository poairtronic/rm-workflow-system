import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { APP_CONFIG } from '../../app/config';

interface InventoryItem {
  id: string;
  material: string;
  materialType: string;
  grade: string;
  size: string;
  unit: string;
  stockBalance?: {
    currentQuantity: number;
  };
}

interface StockInModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockInModal: React.FC<StockInModalProps> = ({ item, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const [formData, setFormData] = useState({
    quantity: '',
    referenceType: 'MANUAL',
    referenceId: '',
    remarks: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(formData.quantity) <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    setError(null);
    setIsConfirming(true);
  };

  const executeStockIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory/${item.id}/stock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          quantity: Number(formData.quantity)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to perform stock in');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Network error');
      setIsConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  const currentAvailable = item.stockBalance?.currentQuantity || 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Stock In</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={loading}>
              ✕
            </button>
          </div>

          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-gray-500">Material:</span>
              <span className="font-semibold">{item.material}</span>
              
              <span className="text-gray-500">Type / Grade:</span>
              <span className="font-semibold">{item.materialType} / {item.grade}</span>
              
              <span className="text-gray-500">Size:</span>
              <span className="font-semibold">{item.size || '—'}</span>
              
              <span className="text-gray-500">Current Available:</span>
              <span className="font-semibold text-blue-700">{Number(currentAvailable).toFixed(3)} {item.unit}</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {!isConfirming ? (
            <form onSubmit={handleInitialSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity ({item.unit})
                </label>
                <input
                  type="number"
                  name="quantity"
                  required
                  min="0.001"
                  step="0.001"
                  className="form-input w-full"
                  placeholder="Enter positive quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Type</label>
                <select
                  name="referenceType"
                  required
                  className="form-select w-full"
                  value={formData.referenceType}
                  onChange={handleChange}
                >
                  <option value="MANUAL">MANUAL (General Stock In)</option>
                  <option value="PURCHASE">PURCHASE (Supplier Delivery)</option>
                  <option value="RETURN">RETURN (General Return)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference ID (Optional)</label>
                <input
                  type="text"
                  name="referenceId"
                  className="form-input w-full"
                  placeholder="e.g. PO-12345 or Delivery Note number"
                  value={formData.referenceId}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                <textarea
                  name="remarks"
                  className="form-input w-full"
                  placeholder="Any additional notes about this stock entry"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit">
                  Continue
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-yellow-800 font-medium text-center">
                  Are you sure you want to add <strong>{formData.quantity} {item.unit}</strong> to <strong>{item.material} {item.size}</strong>?
                </p>
                <p className="text-sm text-yellow-700 text-center mt-2">
                  This action will immediately update the authoritative stock balance and create an immutable historical transaction.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
                <Button type="button" variant="secondary" onClick={() => setIsConfirming(false)} disabled={loading}>
                  Back
                </Button>
                <Button type="button" onClick={executeStockIn} disabled={loading}>
                  {loading ? 'Committing...' : 'Confirm Stock In'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
