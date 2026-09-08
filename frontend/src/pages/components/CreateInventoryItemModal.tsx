import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { APP_CONFIG } from '../../app/config';

interface CreateInventoryItemModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInventoryItemModal: React.FC<CreateInventoryItemModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    material: '',
    materialType: '',
    grade: '',
    size: '',
    unit: '',
    minimumStockLevel: 0,
    isActive: true
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${APP_CONFIG.apiBaseUrl}/api/inventory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          ...formData,
          minimumStockLevel: Number(formData.minimumStockLevel)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('An inventory item with this exact combination of material, type, grade, and size already exists.');
        }
        throw new Error(data.message || 'Failed to create inventory item');
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Add Master Data Item</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
              <strong>Conflict:</strong> {error}
            </div>
          )}

          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded text-sm">
            Strings will be automatically trimmed and converted to uppercase upon saving to prevent duplicates.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material</label>
              <input
                type="text"
                name="material"
                required
                className="form-input w-full"
                placeholder="e.g. OHNS"
                value={formData.material}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
              <input
                type="text"
                name="materialType"
                required
                className="form-input w-full"
                placeholder="e.g. LONG BAR"
                value={formData.materialType}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <input
                type="text"
                name="grade"
                required
                className="form-input w-full"
                placeholder="e.g. O1"
                value={formData.grade}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <input
                type="text"
                name="size"
                required
                className="form-input w-full"
                placeholder="e.g. 45 DIA"
                value={formData.size}
                onChange={handleChange}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <select
                  name="unit"
                  required
                  className="form-select w-full"
                  value={formData.unit}
                  onChange={handleChange}
                >
                  <option value="">Select Unit</option>
                  <option value="KG">KG</option>
                  <option value="PCS">PCS</option>
                  <option value="M">M</option>
                  <option value="MM">MM</option>
                  <option value="SET">SET</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Stock Level</label>
                <input
                  type="number"
                  name="minimumStockLevel"
                  required
                  min="0"
                  step="0.001"
                  className="form-input w-full"
                  value={formData.minimumStockLevel}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
              <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Item'}
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </div>
  );
};
