import { useState, useEffect } from 'react';
import { PackageCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { workflowService } from '../services/workflowService';
import toast from 'react-hot-toast';
import { VerifyReturnModal } from '../components/modals/VerifyReturnModal';

export function StoresReturnVerifyWorkspace() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const res = await workflowService.getReturns('PENDING_STORE_ACK');
      setReturns(res as unknown as any[]);
    } catch (err: any) {
      console.error(err);
      setError('Failed to load returns.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenVerifyModal = (ret: any) => {
    setSelectedReturn(ret);
    setIsVerifyModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Return Verification"
        subtitle="Verify materials returned from Production."
      />

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : returns.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <PackageCheck className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No Returns Pending</h3>
          <p className="text-slate-500 max-w-md mx-auto mb-6">
            There are no material returns waiting for verification.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {returns.map((ret) => (
            <div key={ret.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-900">Return: {ret.returnNumber}</h4>
                  <p className="text-sm text-slate-500">SC: {ret.salesOrderComponent?.scNumber}</p>
                </div>
                <div>
                  <span className="px-2 py-1 text-xs font-medium rounded-md bg-amber-100 text-amber-700">
                    Pending Verification
                  </span>
                </div>
              </div>

              <div className="text-sm text-slate-700 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p><strong>Remarks:</strong> {ret.remarks || 'None'}</p>
              </div>

              <div className="flex-1 space-y-2 mb-4">
                <h5 className="font-semibold text-slate-900 text-sm">Returned Items:</h5>
                {ret.items.map((item: any) => (
                  <div key={item.id} className="text-sm text-slate-600 flex justify-between bg-white border border-slate-200 p-2 rounded">
                    <span>Item ID: {item.rmItemId}</span>
                    <span className="font-medium">{item.quantityReturned}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-4 mt-auto">
                <button
                  onClick={() => handleOpenVerifyModal(ret)}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 font-medium rounded-lg transition-colors shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Verify Return</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedReturn && (
        <VerifyReturnModal
          isOpen={isVerifyModalOpen}
          onClose={() => setIsVerifyModalOpen(false)}
          onSuccess={() => {
            loadReturns();
            toast.success('Return verified successfully');
          }}
          returnId={selectedReturn.id}
          returnNumber={selectedReturn.returnNumber}
        />
      )}
    </div>
  );
}
