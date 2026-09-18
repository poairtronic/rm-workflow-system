import React, { useState, useEffect } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusAlert } from '../components/feedback/StatusAlert';
import { workflowService } from '../services/workflowService';
import type { SC, MaterialAccounting } from '../services/workflowService';
import { masterDataService } from '../services/masterDataService';

interface WorkflowPageProps {
  currentView?: string;
  onNavigate?: (view: any) => void;
}

export const WorkflowPage: React.FC<WorkflowPageProps> = ({
  currentView = 'design-rm',
  onNavigate,
}) => {
  const [scList, setScList] = useState<SC[]>([]);
  const [selectedSc, setSelectedSc] = useState<SC | null>(null);
  const [accounting, setAccounting] = useState<MaterialAccounting | null>(null);
  const [bins, setBins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [poNumber, setPoNumber] = useState('');
  const [scNumber, setScNumber] = useState('');
  const [productName, setProductName] = useState('');
  const [targetQuantity] = useState(1);

  // RM Item Form
  const [material, setMaterial] = useState('');
  const [grade, setGrade] = useState('');
  const [size, setSize] = useState('');
  const [reqQty, setReqQty] = useState(10);

  // Issue Form
  const [selectedBinId, setSelectedBinId] = useState('');
  const [issueQty, setIssueQty] = useState(10);

  // Consumption Form
  const [consumeQty, setConsumeQty] = useState(5);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await workflowService.getScList();
      setScList(data || []);

      const bRes: any = await masterDataService.getBins();
      const binList = bRes?.data || (Array.isArray(bRes) ? bRes : []);
      setBins(binList);
      if (binList.length > 0) {
        setSelectedBinId(binList[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load SC list');
    } finally {
      setLoading(false);
    }
  };

  const selectSc = async (sc: SC) => {
    try {
      setSelectedSc(sc);
      setError(null);
      setSuccess(null);
      const acc = await workflowService.getAccounting(sc.id);
      setAccounting(acc);
    } catch (err: any) {
      setError(err.message || 'Failed to load material accounting');
    }
  };

  const handleCreateSc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const newSc = await workflowService.createSc({
        poNumber,
        scNumber,
        productName,
        targetQuantity,
      });
      setSuccess(`Created SC "${newSc.scNumber}" under PO "${poNumber}".`);
      setPoNumber('');
      setScNumber('');
      setProductName('');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create SC');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRm = async () => {
    if (!selectedSc) return;
    try {
      setLoading(true);
      setError(null);
      await workflowService.createRm(selectedSc.id, 'Created in UI');
      setSuccess(`Created RM Request for SC "${selectedSc.scNumber}". Inventory is NOT reduced.`);
      await selectSc(selectedSc);
    } catch (err: any) {
      setError(err.message || 'Failed to create RM Request');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRmItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSc?.rmRequest?.id) {
      setError('Create RM Request first');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await workflowService.addRmItem(selectedSc.rmRequest.id, {
        material,
        grade,
        size,
        quantity: reqQty,
      });
      setSuccess(`Added RM Item (${material} - ${reqQty}).`);
      setMaterial('');
      setGrade('');
      setSize('');
      await selectSc(selectedSc);
    } catch (err: any) {
      setError(err.message || 'Failed to add RM Item');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRm = async () => {
    if (!selectedSc?.rmRequest?.id) return;
    try {
      setLoading(true);
      setError(null);
      await workflowService.submitRm(selectedSc.rmRequest.id);
      setSuccess(`Submitted RM Request for SC "${selectedSc.scNumber}". Ready for Stores stock verification.`);
      await selectSc(selectedSc);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to submit RM Request');
    } finally {
      setLoading(false);
    }
  };

  const handleIssueMaterial = async (rmItemId: string) => {
    if (!selectedSc || !selectedBinId) {
      setError('Select target SC and Bin first');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      await workflowService.createIssue(selectedSc.id, [
        { rmItemId, binId: selectedBinId, quantityIssued: issueQty },
      ]);
      setSuccess(`Issued ${issueQty} units from Bin. Inventory atomically decremented!`);
      await selectSc(selectedSc);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to issue material');
    } finally {
      setLoading(false);
    }
  };

  const handleReceive = async () => {
    if (!selectedSc || !accounting?.items[0]) return;
    try {
      setLoading(true);
      setError(null);
      const item = accounting.items[0];
      await workflowService.receiveMaterial(selectedSc.id, [
        { rmItemId: item.rmItemId, quantityReceived: item.issued },
      ]);
      setSuccess(`Production received material for SC "${selectedSc.scNumber}".`);
      await selectSc(selectedSc);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to receive material');
    } finally {
      setLoading(false);
    }
  };

  const handleConsume = async (rmItemId: string) => {
    if (!selectedSc) return;
    try {
      setLoading(true);
      setError(null);
      await workflowService.recordConsumption(selectedSc.id, rmItemId, consumeQty);
      setSuccess(`Recorded consumption of ${consumeQty} units. Stock is NOT double-deducted.`);
      await selectSc(selectedSc);
    } catch (err: any) {
      setError(err.message || 'Failed to record consumption');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSc = async () => {
    if (!selectedSc) return;
    try {
      setLoading(true);
      setError(null);
      await workflowService.closeSc(selectedSc.id, 'Independent SC closure');
      setSuccess(`Closed SC "${selectedSc.scNumber}". Siblings under PO remain open.`);
      await selectSc(selectedSc);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to close SC');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout activeNav={currentView} onNavigate={onNavigate}>
      <div className="page-container">
        {error && <StatusAlert type="error" title="Workflow Error" message={error} />}
        {success && <StatusAlert type="success" title="Operation Successful" message={success} />}

        {/* Top Panel: Create SC */}
        <Card title="Sales Order Component (SC) Management" subtitle="PO is external; each SC closes independently">
          <form onSubmit={handleCreateSc} className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">PO Number (External)</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. PO-9001"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">SC Number</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. SC-1001"
                value={scNumber}
                onChange={(e) => setScNumber(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Product Name</label>
              <input
                type="text"
                required
                className="input-field"
                placeholder="e.g. Precision Shaft"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading} variant="primary">
                + Create SC
              </Button>
            </div>
          </form>

          {/* SC List Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>SC Number</th>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scList.map((sc) => (
                  <tr
                    key={sc.id}
                    className={selectedSc?.id === sc.id ? 'bg-primary-light font-medium' : ''}
                  >
                    <td>{sc.purchaseOrder?.poNumber || 'PO-DEF'}</td>
                    <td>{sc.scNumber}</td>
                    <td>{sc.productName}</td>
                    <td>
                      <span className="badge badge-info">{sc.status}</span>
                    </td>
                    <td>{sc.createdAt ? new Date(sc.createdAt).toLocaleString() : '—'}</td>
                    <td>
                      <Button
                        size="sm"
                        variant={selectedSc?.id === sc.id ? 'primary' : 'secondary'}
                        onClick={() => selectSc(sc)}
                      >
                        Select SC
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Workflow Detail for Selected SC */}
        {selectedSc && (
          <div className="grid grid-cols-2 gap-6">
            {/* Column 1: Designer & Stores Issue */}
            <Card title={`1 & 2. Design RM & Stores Stock Issue (${selectedSc.scNumber})`}>
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded">
                  <div>
                    <span className="font-semibold">RM Status:</span>{' '}
                    <span className="badge badge-warning">
                      {selectedSc.rmRequest?.status || 'NOT_CREATED'}
                    </span>
                  </div>
                  {!selectedSc.rmRequest && (
                    <Button size="sm" onClick={handleCreateRm} disabled={loading}>
                      Create RM Request
                    </Button>
                  )}
                  {selectedSc.rmRequest?.status === 'DRAFT' && (
                    <Button size="sm" variant="primary" onClick={handleSubmitRm} disabled={loading}>
                      Submit RM to Stores
                    </Button>
                  )}
                </div>

                {/* Add Item Form */}
                {selectedSc.rmRequest?.status === 'DRAFT' && (
                  <form onSubmit={handleAddRmItem} className="grid grid-cols-4 gap-2 border p-3 rounded">
                    <input
                      type="text"
                      placeholder="Material"
                      required
                      className="input-field"
                      value={material}
                      onChange={(e) => setMaterial(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Grade"
                      required
                      className="input-field"
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Size"
                      required
                      className="input-field"
                      value={size}
                      onChange={(e) => setSize(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Qty"
                      required
                      min={1}
                      className="input-field"
                      value={reqQty}
                      onChange={(e) => setReqQty(Number(e.target.value))}
                    />
                    <div className="col-span-4 mt-2">
                      <Button size="sm" type="submit" disabled={loading}>
                        + Add Material Item
                      </Button>
                    </div>
                  </form>
                )}

                {/* Stores Stock Issue Panel */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm mb-2">Stores Material Issue (Exact Bin Stock Deduction)</h4>
                  <div className="flex items-center space-x-2 mb-3">
                    <label className="text-sm font-medium">Source Bin:</label>
                    <select
                      className="input-field"
                      value={selectedBinId}
                      onChange={(e) => setSelectedBinId(e.target.value)}
                    >
                      {bins.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} (Rack: {b.rack?.code || 'R1'})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="input-field w-24"
                      value={issueQty}
                      onChange={(e) => setIssueQty(Number(e.target.value))}
                    />
                  </div>

                  {accounting?.items.map((item) => (
                    <div key={item.rmItemId} className="flex justify-between items-center bg-blue-50 p-2 rounded mb-2">
                      <div>
                        <strong>{item.material} ({item.grade})</strong> - Req: {item.required}, Issued: {item.issued}
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleIssueMaterial(item.rmItemId)}
                        disabled={loading || selectedSc.status === 'COMPLETED'}
                      >
                        Issue from Bin
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Column 2: Production Accounting & Completion */}
            <Card title={`3 & 4. Production Receipt, Consumption & Independent SC Closure`}>
              <div className="space-y-4">
                <div className="flex space-x-2">
                  <Button size="sm" variant="secondary" onClick={handleReceive} disabled={loading}>
                    Receive Issued Material
                  </Button>
                  <Button size="sm" variant="danger" onClick={handleCloseSc} disabled={loading}>
                    Close SC (Independent)
                  </Button>
                </div>

                {/* Accounting Matrix Table */}
                <h4 className="font-semibold text-sm">Material Accounting Matrix (Unaccounted = Received - Consumed - Returned)</h4>
                <table className="data-table text-xs">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th>Required</th>
                      <th>Issued</th>
                      <th>Consumed</th>
                      <th>Returned</th>
                      <th>Unaccounted</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounting?.items.map((item) => (
                      <tr key={item.rmItemId}>
                        <td>{item.material}</td>
                        <td>{item.required}</td>
                        <td>{item.issued}</td>
                        <td>{item.consumed}</td>
                        <td>{item.returned}</td>
                        <td className="font-bold text-blue-600">{item.unaccounted}</td>
                        <td>
                          <div className="flex space-x-1">
                            <input
                              type="number"
                              className="input-field w-16 p-1 text-xs"
                              value={consumeQty}
                              onChange={(e) => setConsumeQty(Number(e.target.value))}
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleConsume(item.rmItemId)}
                              disabled={loading}
                            >
                              Consume
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default WorkflowPage;
