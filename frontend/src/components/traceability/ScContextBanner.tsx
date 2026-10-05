import { FileBadge } from 'lucide-react';
import type { ScMasterData } from '../../types/traceability.dto';

interface ScContextBannerProps {
  masterData: ScMasterData;
}

export function ScContextBanner({ masterData }: ScContextBannerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-100 text-emerald-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'PARTIAL': return 'bg-amber-100 text-amber-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 bg-slate-50">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileBadge className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Sales Order Component</h2>
          <p className="text-lg font-bold text-slate-900 tracking-tight">{masterData.scCode}</p>
        </div>
        <div className="ml-auto">
          <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${getStatusColor(masterData.fulfillmentStatus)}`}>
            {masterData.fulfillmentStatus.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Parent PO Number</p>
            <p className="text-sm font-medium text-slate-900">{masterData.poNumber}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Customer</p>
            <p className="text-sm font-medium text-slate-900">{masterData.customerName}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nomenclature</p>
            <p className="text-sm font-medium text-slate-900">{masterData.nomenclature}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Drawing Number</p>
            <p className="text-sm font-medium text-slate-900">{masterData.drawingNumber}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
