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

interface StockOutModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

export const StockOutModal: React.FC<StockOutModalProps> = ({ item, onClose, onSuccess }) => {
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

  const currentAvailable = item.stockBalance?.currentQuantity || 0;

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(formData.quantity);
    if (qty <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (qty > currentAvailable) {
      setError(`Insufficient stock. Available: ${Number(currentAvailable).toFixed(3)} ${item.unit}`);
      return;
    }
    setError(null);
    setIsConfirming(true);
  };

  const executeStockOut = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory/${item.id}/stock-out`, {
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
        throw new Error(data.message || 'Failed to perform stock out');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Network error');
      setIsConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Stock Out</h2>
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
                  max={currentAvailable}
                  className="form-input w-full"
                  placeholder="Enter quantity to remove"
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
                  <option value="MANUAL">MANUAL (General Stock Out)</option>
                  <option value="ISSUE">ISSUE (Stores Issue)</option>
                  <option value="SCRAP">SCRAP (Wastage / Scrap)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference ID (Optional)</label>
                <input
                  type="text"
                  name="referenceId"
                  className="form-input w-full"
                  placeholder="e.g. Issue Note number"
                  value={formData.referenceId}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remarks (Optional)</label>
                <textarea
                  name="remarks"
                  className="form-input w-full"
                  placeholder="Any additional notes about this stock removal"
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
                  Are you sure you want to remove <strong>{formData.quantity} {item.unit}</strong> from <strong>{item.material} {item.size}</strong>?
                </p>
                <p className="text-sm text-yellow-700 text-center mt-2">
                  This action will immediately deduct from the authoritative stock balance and create an immutable historical transaction.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
                <Button type="button" variant="secondary" onClick={() => setIsConfirming(false)} disabled={loading}>
                  Back
                </Button>
                <Button type="button" onClick={executeStockOut} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white border-transparent">
                  {loading ? 'Committing...' : 'Confirm Stock Out'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
