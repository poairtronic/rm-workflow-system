import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  Clock, 
  Search, 
  ShieldCheck, 
  CheckCircle2
} from 'lucide-react';
import { workflowService } from '../services/workflowService';
import toast from 'react-hot-toast';

interface MaterialIssue {
  id: string;
  issueNumber: string;
  issueType: string;
  issueDate: string;
  createdAt: string;
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
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PENDING'>('LEDGER');

  // Pending Issues State
  const [issues, setIssues] = useState<MaterialIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);

  // Completed Receipts History State
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Receive Modal State
  const [receivingIssueId, setReceivingIssueId] = useState<string | null>(null);
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([loadIssues(), loadReceipts()]);
  };

  const loadIssues = async () => {
    setLoadingIssues(true);
    try {
      const data: any[] = await workflowService.getIssueList();
      const pendingIssues = data.filter(issue => {
        return issue.items.some((item: any) => {
          const received = calculateReceived(issue, item.rmItem?.id);
          return item.quantityIssued > received;
        });
      });
      setIssues(pendingIssues);
    } catch (err: any) {
      setError(err.message || 'Failed to load issues');
    } finally {
      setLoadingIssues(false);
    }
  };

  const loadReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const data = await workflowService.getReceipts();
      setReceipts(data || []);
    } catch (err: any) {
      console.error('Failed to load receipts ledger', err);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const calculateReceived = (issue: MaterialIssue, rmItemId?: string) => {
    if (!issue.receipts || !rmItemId) return 0;
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
      const received = calculateReceived(issue, item.rmItem?.id);
      const pending = item.quantityIssued - received;
      if (pending > 0 && item.rmItem?.id) {
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
      toast.error('Please enter at least one valid quantity to receive.');
      return;
    }

    setSubmitting(true);
    try {
      await workflowService.receiveMaterial(issue.id, issue.salesOrderComponent.id, payloadItems);
      toast.success('Raw Material receipt acknowledged and logged in custody ledger!');
      setReceivingIssueId(null);
      setReceiptQuantities({});
      await loadData();
      setActiveTab('LEDGER');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to receive material');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter receipts in ledger
  const filteredReceipts = receipts.filter(rc => {
    const q = searchQuery.toLowerCase();
    const scNum = rc.materialIssue?.salesOrderComponent?.scNumber?.toLowerCase() || '';
    const prod = rc.materialIssue?.salesOrderComponent?.productName?.toLowerCase() || '';
    const receiver = rc.receivedBy?.name?.toLowerCase() || '';
    const email = rc.receivedBy?.email?.toLowerCase() || '';
    const issueNum = rc.materialIssue?.issueNumber?.toLowerCase() || '';

    return !q || scNum.includes(q) || prod.includes(q) || receiver.includes(q) || email.includes(q) || issueNum.includes(q);
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl font-bold text-slate-900">My RM — Custody & Receipt Ledger</h1>
            <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Production Custody
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track who received Raw Material against each SC, verify shop-floor custody, and acknowledge incoming Stores dispatches.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'LEDGER'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Receipt & Custody Ledger ({receipts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              activeTab === 'PENDING'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Pending Receipts ({issues.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2 border border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: WHO RECEIVED RM AGAINST SC (CUSTODY LEDGER) */}
      {activeTab === 'LEDGER' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Shop Floor Material Receipt Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Complete record of operators who received physical RM against each Sales Order Component.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search SC, Operator, Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {loadingReceipts ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-16">
              <UserCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-base font-semibold text-slate-800">No Receipt Records Found</h4>
              <p className="text-xs text-slate-500 mt-1">
                {searchQuery ? 'No records match your search.' : 'No raw materials have been received on the shop floor yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Component (SC)</th>
                    <th className="py-3 px-4">Issue Reference</th>
                    <th className="py-3 px-4">Received Materials</th>
                    <th className="py-3 px-4">Received By (Operator Info)</th>
                    <th className="py-3 px-4">Receipt Timestamp</th>
                    <th className="py-3 px-4 text-center">Receipt Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReceipts.map((rc) => {
                    const sc = rc.materialIssue?.salesOrderComponent;
                    const operator = rc.receivedBy;
                    return (
                      <tr key={rc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{sc?.scNumber || 'N/A'}</div>
                          <div className="text-slate-500 truncate max-w-xs">{sc?.productName || ''}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          {rc.materialIssue?.issueNumber || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4">
                          {rc.items && rc.items.length > 0 ? (
                            <div className="space-y-1">
                              {rc.items.map((it: any) => (
                                <div key={it.id} className="text-slate-700">
                                  <span className="font-medium text-slate-900">{it.rmItem?.material || 'Material'}</span>: <strong className="text-emerald-700">{it.quantityReceived}</strong> received
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">All requested items</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs">
                              {operator?.name ? operator.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{operator?.name || 'Production User'}</div>
                              <div className="text-[11px] text-slate-500">{operator?.email || 'operator@airtronic.com'}</div>
                              <div className="text-[10px] text-slate-400">Role: {operator?.role || 'PRODUCTION'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                          <div>{new Date(rc.createdAt).toLocaleDateString()}</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(rc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {rc.status || 'RECEIVED'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PENDING DISPATCHES AWAITING PRODUCTION RECEIPT */}
      {activeTab === 'PENDING' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Dispatched Issues Awaiting Confirmation</h3>
                <p className="text-xs text-slate-500 mt-0.5">Physical goods issued by Stores that must be confirmed upon shop floor arrival.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                {issues.length} Pending
              </span>
            </div>

            {loadingIssues ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : issues.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-base font-semibold text-slate-800">All Dispatches Received</h4>
                <p className="text-xs text-slate-500 mt-1">There are no pending material issues waiting for receipt.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {issues.map((issue) => (
                  <div key={issue.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          Issue: {issue.issueNumber}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                          {issue.issueType}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(issue.createdAt || issue.issueDate).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700">
                        Component (SC): <strong className="text-slate-900">{issue.salesOrderComponent?.scNumber}</strong>
                        {issue.salesOrderComponent?.productName && <> ({issue.salesOrderComponent.productName})</>}
                      </div>

                      <div className="flex flex-wrap gap-2 pt-1">
                        {issue.items.map((item) => {
                          const received = calculateReceived(issue, item.rmItem?.id);
                          const pending = item.quantityIssued - received;
                          return (
                            <span key={item.id} className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs text-slate-700">
                              {item.rmItem?.material || 'Material'}: Issued {item.quantityIssued} | <strong className="text-amber-600">Pending {pending}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => openReceiveModal(issue)}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Acknowledge Receipt</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acknowledge Receipt Modal */}
      {receivingIssueId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Acknowledge Raw Material Receipt</h3>
              </div>
              <button
                onClick={() => setReceivingIssueId(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Verify the quantities physically received on the shop floor. This will log your employee credentials as the custodian for this material.
            </p>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {issues.find(i => i.id === receivingIssueId)?.items.map((item) => {
                const received = calculateReceived(issues.find(i => i.id === receivingIssueId)!, item.rmItem?.id);
                const pending = item.quantityIssued - received;
                if (pending <= 0) return null;

                return (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">{item.rmItem?.material}</div>
                      <div className="text-[11px] text-slate-500">
                        Total Issued: {item.quantityIssued} | Remaining to Receive: {pending}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <label className="text-[11px] font-semibold text-slate-600">Received:</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        max={pending}
                        value={receiptQuantities[item.rmItem?.id] || ''}
                        onChange={(e) => setReceiptQuantities({ ...receiptQuantities, [item.rmItem?.id]: e.target.value })}
                        className="w-24 px-2 py-1 text-xs bg-white border border-slate-300 rounded text-right font-bold focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReceivingIssueId(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReceive}
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submitting ? 'Confirming...' : 'Confirm Receipt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
