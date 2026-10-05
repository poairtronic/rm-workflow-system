import { useFormContext } from 'react-hook-form';
import { Fingerprint, Package, Scale, ShieldCheck } from 'lucide-react';
import type { CreateDeliveryChallanDto } from '../../types/delivery-challan.dto';

export function DispatchReviewView() {
  const { watch } = useFormContext<CreateDeliveryChallanDto>();
  
  const items = watch('items') || [];
  const scCode = watch('scCode');
  const processId = watch('processId');
  const vendorId = watch('vendorId');
  const expectedReturnDate = watch('expectedReturnDate');

  const totalItemCount = items.length;
  const totalGrossWeight = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Package className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Items</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalItemCount}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Scale className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Gross Weight (KG)</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalGrossWeight.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Context Summary */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 border-b border-slate-100 pb-2">Dispatch Context</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">SC Code</p>
            <p className="text-sm font-medium text-slate-900">{scCode || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Process</p>
            <p className="text-sm font-medium text-slate-900">{processId || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Vendor ID</p>
            <p className="text-sm font-medium text-slate-900">{vendorId || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Expected Return</p>
            <p className="text-sm font-medium text-slate-900 tabular-nums">{expectedReturnDate ? new Date(expectedReturnDate).toLocaleDateString() : 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Cryptographic Signature Placeholder */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center flex-shrink-0 border border-slate-100">
            <Fingerprint className="w-5 h-5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              Cryptographic Lock Ready
              <ShieldCheck className="w-4 h-4 text-green-600" />
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Upon generation, this payload will be hashed (SHA-256) and locked into the ledger. Revisions after this point will require formal Manager-level amendments.
            </p>
            <div className="mt-4 p-3 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-400 break-all select-none">
              AWAITING_SUBMISSION_HASH... {Array(48).fill('0').join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
