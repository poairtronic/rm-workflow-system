import React, { useState } from 'react';
import type { IssueMaterialPayload } from '../types';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/forms/FormField';
import { StatusAlert } from '../../../components/feedback/StatusAlert';

interface MaterialIssueFormProps {
  scNumber: string;
  poNumber: string;
  materials: Array<{
    materialId: string;
    grade: string;
    size: string;
    requiredQty: number;
    unit: string;
  }>;
  onSubmit: (payload: IssueMaterialPayload) => Promise<any>;
  loading?: boolean;
  error?: string | null;
}

export const MaterialIssueForm: React.FC<MaterialIssueFormProps> = ({
  scNumber,
  poNumber,
  materials,
  onSubmit,
  loading = false,
  error = null,
}) => {
  const [issuedQuantities, setIssuedQuantities] = useState<Record<string, number>>({});
  const [batchNumbers, setBatchNumbers] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<string>('');

  const handleQtyChange = (materialId: string, value: string) => {
    const num = parseFloat(value) || 0;
    setIssuedQuantities((prev) => ({ ...prev, [materialId]: num }));
  };

  const handleBatchChange = (materialId: string, value: string) => {
    setBatchNumbers((prev) => ({ ...prev, [materialId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const items = materials.map((m) => ({
      materialId: m.materialId,
      grade: m.grade,
      size: m.size,
      requiredQty: m.requiredQty,
      issueQty: issuedQuantities[m.materialId] ?? m.requiredQty,
      unit: m.unit,
      batchNumber: batchNumbers[m.materialId],
    }));

    onSubmit({
      scNumber,
      poNumber,
      items,
      remarks,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="material-issue-form">
      {error && <StatusAlert type="error" message={error} />}

      <div className="form-header-meta">
        <span className="badge badge-active">{scNumber}</span>
        <span className="meta-text">PO Reference: {poNumber}</span>
      </div>

      <div className="materials-issue-table">
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th>Required</th>
              <th>Issue Quantity</th>
              <th>Heat / Batch #</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.materialId}>
                <td>
                  <strong>{m.grade}</strong> · <span className="mono">{m.size}</span>
                </td>
                <td>
                  {m.requiredQty} {m.unit}
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={m.requiredQty}
                    onChange={(e) => handleQtyChange(m.materialId, e.target.value)}
                    className="input-sm"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    placeholder="Optional batch"
                    onChange={(e) => handleBatchChange(m.materialId, e.target.value)}
                    className="input-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <FormField label="Stores Remarks">
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Enter any physical store remarks or heat certificate notes..."
          rows={2}
          className="textarea"
        />
      </FormField>

      <div className="form-actions">
        <Button type="submit" disabled={loading} variant="primary">
          {loading ? 'Processing Issue...' : 'Confirm & Issue Materials'}
        </Button>
      </div>
    </form>
  );
};
