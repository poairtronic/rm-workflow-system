import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EmptyState } from '../components/ui/EmptyState';
import { workflowService } from '../services/workflowService';

interface MaterialIssue {
  id: string;
  issueNumber: string;
  issueType: string;
  issueDate: string;
  salesOrderComponent: {
    id: string;
    scNumber: string;
    productName: string;
  };
  items: {
    id: string;
    rmItem: {
      id: string;
      material: string;
      grade: string;
    };
    quantityIssued: number;
  }[];
  receipts?: {
    id: string;
    status: string;
    items: {
      rmItemId: string;
      quantityReceived: number;
    }[];
  }[];
}

export function ProductionRmWorkspace() {
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [receivingIssueId, setReceivingIssueId] = useState<string | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadIssues();
  }, []);

  const loadIssues = async () => {
    setLoading(true);
    try {
      const data: any[] = await workflowService.getIssueList();
      
      // Filter issues that have pending quantities
      const pendingIssues = data.filter(issue => {
        return issue.items.some((item: any) => {
          const received = calculateReceived(issue, item.rmItem.id);
          return item.quantityIssued > received;
        });
      });

      setIssues(pendingIssues);
    } catch (err: any) {
      setError(err.message || 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  };

  const calculateReceived = (issue: MaterialIssue, rmItemId: string) => {
    if (!issue.receipts) return 0;
    let total = 0;
    for (const receipt of issue.receipts) {
      for (const rItem of receipt.items) {
        if (rItem.rmItemId === rmItemId) {
          total += Number(rItem.quantityReceived);
        }
      }
    }
    return total;
  };

  const openReceiveModal = (issue: MaterialIssue) => {
    const defaultQtys: Record<string, string> = {};
    issue.items.forEach((item: any) => {
      const received = calculateReceived(issue, item.rmItem.id);
      const pending = item.quantityIssued - received;
      if (pending > 0) {
        defaultQtys[item.rmItem.id] = pending.toString();
      }
    });
    setReceiptQuantities(defaultQtys);
    setReceivingIssueId(issue.id);
  };

  const handleReceive = async () => {
    if (!receivingIssueId) return;
    const issue = issues.find(i => i.id === receivingIssueId);
    if (!issue) return;

    const payloadItems = Object.entries(receiptQuantities).map(([rmItemId, qtyStr]) => ({
      rmItemId,
      quantityReceived: Number(qtyStr)
    })).filter((item: any) => item.quantityReceived > 0);

    if (payloadItems.length === 0) {
      return alert('Please enter at least one valid quantity to receive.');
    }

    setSubmitting(true);
    try {
      await workflowService.receiveMaterial(issue.id, issue.salesOrderComponent.id, payloadItems);
      setReceivingIssueId(null);
      setReceiptQuantities({});
      await loadIssues();
    } catch (err: any) {
      alert(err.message || 'Failed to receive material');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading pending receipts...</div>;
  }

  if (receivingIssueId) {
    const currentIssue = issues.find(i => i.id === receivingIssueId);
    return (
      <div className="max-w-4xl mx-auto w-full pb-12">
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setReceivingIssueId(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Issue List</span>
          </button>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            Production Receipt
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-200 bg-slate-50/50">
            <h3 className="text-xl font-bold text-slate-900">Confirm Material Receipt</h3>
            <p className="text-sm text-slate-500 mt-1">
              Issue Number: <span className="font-semibold text-slate-800">{currentIssue?.issueNumber}</span> • Component: <span className="font-semibold text-slate-800">{currentIssue?.salesOrderComponent.scNumber}</span>
            </p>
          </div>

          <div className="p-8 space-y-4">
            {currentIssue?.items.map((item: any) => {
              const pending = item.quantityIssued - calculateReceived(currentIssue, item.rmItem.id);
              if (pending <= 0) return null;

              return (
                <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <p className="font-semibold text-slate-900">{item.rmItem.material}</p>
                    <p className="text-xs text-slate-500 mt-0.5">Grade: {item.rmItem.grade || 'Standard'} • Pending to Receive: <span className="font-bold text-slate-700">{pending}</span></p>
                  </div>
                  <div className="w-36">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Receive Qty</label>
                    <input
                      type="number"
                      min="0"
                      max={pending}
                      step="0.001"
                      value={receiptQuantities[item.rmItem.id] || ''}
                      onChange={(e) => setReceiptQuantities({ ...receiptQuantities, [item.rmItem.id]: e.target.value })}
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end space-x-3 px-8 py-5 border-t border-slate-200 bg-slate-50/50">
            <button
              onClick={() => setReceivingIssueId(null)}
              className="px-5 py-2.5 text-sm font-medium text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover shadow-sm disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Confirming...' : 'Confirm Receipt'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Material Receipts"
        subtitle="Review and receive raw material issued by Stores."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {issues.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-10 h-10 text-slate-400" />}
          title="All Caught Up"
          description="There are no pending material issues waiting for receipt."
        />
      ) : (
        <div className="space-y-6">
          {issues.map(issue => (
            <div key={issue.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <h3 className="font-semibold text-slate-900">Issue {issue.issueNumber}</h3>
                    <StatusBadge status="PENDING_RECEIPT" />
                    {issue.issueType === 'ADDITIONAL_ISSUE' && (
                       <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                         Extra Material
                       </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    SC: {issue.salesOrderComponent.scNumber} ({issue.salesOrderComponent.productName}) • Issued on {new Date(issue.issueDate).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => openReceiveModal(issue)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                >
                  Receive Material
                </button>
              </div>
              <div className="p-6">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-100">
                      <th className="pb-2">RM / Material</th>
                      <th className="pb-2">Grade</th>
                      <th className="pb-2 text-right">Total Issued</th>
                      <th className="pb-2 text-right">Already Received</th>
                      <th className="pb-2 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {issue.items.map((item: any) => {
                      const received = calculateReceived(issue, item.rmItem.id);
                      const pending = item.quantityIssued - received;
                      if (pending <= 0) return null;

                      return (
                        <tr key={item.id}>
                          <td className="py-3 text-slate-900 font-medium">{item.rmItem.material}</td>
                          <td className="py-3 text-slate-500">{item.rmItem.grade || '-'}</td>
                          <td className="py-3 text-right text-slate-900 font-medium">{item.quantityIssued}</td>
                          <td className="py-3 text-right text-slate-500">{received}</td>
                          <td className="py-3 text-right text-indigo-600 font-semibold">{pending}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
