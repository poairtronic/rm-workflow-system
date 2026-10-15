import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, PackageCheck, Search, Box } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';
import toast from 'react-hot-toast';

interface IssueItem {
  id: string;
  rmItemId: string;
  rmItem?: {
    id: string;
    material: string;
    grade?: string;
    size?: string;
  };
  quantityIssued: number;
  bin?: {
    code: string;
    rack?: {
      code: string;
    };
  };
  binCode?: string;
  rackCode?: string;
}

interface MaterialIssueLot {
  id: string;
  scId: string;
  issueNumber: string;
  issueType: string;
  remarks?: string;
  createdAt: string;
  salesOrderComponent?: {
    id: string;
    scNumber: string;
    productName: string;
    purchaseOrder?: {
      poNumber: string;
    };
  };
  items: IssueItem[];
}

export function ProductionRmVerifyWorkspace() {
  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<MaterialIssueLot[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [issueData, receiptData] = await Promise.all([
        workflowService.getIssueList(),
        workflowService.getReceipts(),
      ]);

      // Filter issues that haven't been received yet
      const receivedIssueIds = new Set(
        (receiptData || []).map((r: any) => r.materialIssueId || r.materialIssue?.id).filter(Boolean)
      );

      const unreceived = (issueData || []).filter((issue: any) => !receivedIssueIds.has(issue.id));

      setIssues(unreceived);
      setReceipts(receiptData || []);
    } catch (err: any) {
      console.error('Failed to load issue lots', err);
      toast.error('Failed to load material issues from Stores');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceived = async (issue: MaterialIssueLot) => {
    setReceivingId(issue.id);
    try {
      // Automatic 1-click confirmation: take all items and their exact issued quantities
      const itemsToReceive = issue.items.map((it) => ({
        rmItemId: it.rmItemId || it.rmItem?.id || it.id,
        quantityReceived: Number(it.quantityIssued),
      }));

      await workflowService.receiveMaterial(
        issue.id,
        issue.scId,
        itemsToReceive,
        'Shopfloor receipt confirmed'
      );

      toast.success(`Receipt confirmed for Issue #${issue.issueNumber}!`);
      await loadData();
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || err.message || 'Failed to confirm receipt');
    } finally {
      setReceivingId(null);
    }
  };

  const filteredIssues = issues.filter((iss) => {
    const q = searchTerm.toLowerCase();
    const scNum = iss.salesOrderComponent?.scNumber?.toLowerCase() || '';
    const poNum = iss.salesOrderComponent?.purchaseOrder?.poNumber?.toLowerCase() || '';
    const prodName = iss.salesOrderComponent?.productName?.toLowerCase() || '';
    const issNum = iss.issueNumber.toLowerCase();
    return issNum.includes(q) || scNum.includes(q) || poNum.includes(q) || prodName.includes(q);
  });

  const filteredReceipts = receipts.filter((rec) => {
    const q = searchTerm.toLowerCase();
    const scNum = rec.salesOrderComponent?.scNumber?.toLowerCase() || rec.scNumber?.toLowerCase() || '';
    const recNum = rec.receiptNumber?.toLowerCase() || '';
    return scNum.includes(q) || recNum.includes(q);
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="RM Receive & Verify"
        subtitle="Confirm physical receipt of raw materials and parts issued by Stores to the Production floor with a single click."
        actionSlot={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'PENDING'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Pending Receipt ({issues.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'HISTORY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Receipt Ledger ({receipts.length})
            </button>
          </div>
        }
      />

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Issue #, SC, PO, or Product..."
            className="w-full pl-9 pr-3.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          />
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          {activeTab === 'PENDING' ? `${filteredIssues.length} pending lots` : `${filteredReceipts.length} past receipts`}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : activeTab === 'PENDING' ? (
        filteredIssues.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <PackageCheck className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">All Issued Materials Received</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              There are currently no raw material issue lots waiting for shop-floor receipt confirmation.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue) => {
              const scNum = issue.salesOrderComponent?.scNumber || 'N/A';
              const poNum = issue.salesOrderComponent?.purchaseOrder?.poNumber || 'Direct SC';
              const prodName = issue.salesOrderComponent?.productName || 'Manufacturing Assembly';
              const isReceiving = receivingId === issue.id;

              return (
                <div
                  key={issue.id}
                  className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden hover:border-indigo-300 transition-all"
                >
                  <div className="p-5 bg-slate-50/70 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-3">
                        <span className="px-2.5 py-1 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-md">
                          Issue #{issue.issueNumber}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{scNum}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-600 font-medium">{prodName}</span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 font-semibold">Ref: {poNum}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Dispatched from Stores on {new Date(issue.createdAt).toLocaleString()}
                        {issue.remarks && <span className="ml-2 italic text-slate-600">• "{issue.remarks}"</span>}
                      </p>
                    </div>

                    <button
                      onClick={() => handleConfirmReceived(issue)}
                      disabled={isReceiving}
                      className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isReceiving ? 'Confirming...' : issue.items.length > 1 ? 'Receive All' : 'Received'}</span>
                    </button>
                  </div>

                  {/* Items List */}
                  <div className="p-5">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <th className="pb-2">Material / Part</th>
                          <th className="pb-2">Grade / Size</th>
                          <th className="pb-2 text-right">Qty Issued</th>
                          <th className="pb-2 text-right">Source Rack & Bin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {issue.items.map((it, idx) => (
                          <tr key={it.id || idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 font-semibold text-slate-900">
                              {it.rmItem?.material || 'Raw Material'}
                            </td>
                            <td className="py-2.5 text-slate-600 text-xs">
                              {[it.rmItem?.grade, it.rmItem?.size].filter(Boolean).join(' • ') || 'Standard Specification'}
                            </td>
                            <td className="py-2.5 text-right font-bold text-emerald-700 tabular-nums">
                              {it.quantityIssued}
                            </td>
                            <td className="py-2.5 text-right text-xs font-medium text-slate-600">
                              <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                                <Box className="w-3 h-3 mr-1 text-slate-400" />
                                {it.rackCode ? `Rack ${it.rackCode} - ` : ''}{it.binCode || it.bin?.code || 'Bin Allocated'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* History Ledger */
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Receipt #</th>
                <th className="px-6 py-3.5">SC Reference</th>
                <th className="px-6 py-3.5">Received Date & Time</th>
                <th className="px-6 py-3.5">Received By (Operator)</th>
                <th className="px-6 py-3.5">Items Received</th>
                <th className="px-6 py-3.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-50/50">
                  <td className="px-6 py-4 font-bold text-slate-900">{rec.receiptNumber || `REC-${rec.id.slice(0, 8)}`}</td>
                  <td className="px-6 py-4 text-slate-700 font-medium">
                    {rec.salesOrderComponent?.scNumber || rec.scNumber || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(rec.receivedAt || rec.createdAt || rec.receiptDate).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                    {rec.receivedBy?.name || rec.receivedBy?.email || rec.receivedById || 'Operator'}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-600">
                    {(rec.items || []).map((it: any) => `${it.rmItem?.material || 'Material'}: ${it.quantityReceived}`).join(', ') || 'Receipt recorded'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="px-2.5 py-1 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-full inline-flex items-center space-x-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Received</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
