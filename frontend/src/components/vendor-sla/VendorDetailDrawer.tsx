import { useQuery } from '@tanstack/react-query';
import {
  X,
  Building2,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  Package,
  CheckCircle2,
} from 'lucide-react';
import { vendorMasterApi, deliveryChallanApi } from '../../services/api';

interface VendorDetailDrawerProps {
  vendorId: string | null;
  onClose: () => void;
}

export function VendorDetailDrawer({
  vendorId,
  onClose,
}: VendorDetailDrawerProps) {
  // 1. Fetch vendor master details
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors-master-list'],
    queryFn: () => vendorMasterApi.getAll(),
    enabled: !!vendorId,
  });

  const vendor = vendors.find((v) => v.id === vendorId);

  // 2. Fetch vendor capabilities
  const { data: capabilities = [] } = useQuery({
    queryKey: ['vendor-capabilities', vendorId],
    queryFn: () => (vendorId ? vendorMasterApi.getCapabilities(vendorId) : Promise.resolve([])),
    enabled: !!vendorId,
  });

  // 3. Fetch active Delivery Challans in custody
  const { data: allDcs = [] } = useQuery({
    queryKey: ['delivery-challans-all'],
    queryFn: () => deliveryChallanApi.getAll(),
    enabled: !!vendorId,
  });

  if (!vendorId) return null;

  const vendorDcs = (allDcs as any[]).filter(
    (dc) => dc.vendorId === vendorId || dc.vendor?.id === vendorId
  );
  const activeDcs = vendorDcs.filter(
    (dc) => dc.status === 'OPEN' || dc.status === 'DISPATCHED' || dc.status === 'PARTIAL_RETURN'
  );
  const closedDcs = vendorDcs.filter((dc) => dc.status === 'CLOSED');

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-white shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center font-bold text-lg border border-blue-200">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {vendor?.name || 'Vendor Profile'}
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    vendor?.isActive
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {vendor?.isActive ? 'Active Partner' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {vendor?.code || vendorId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact Details Card */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Contact & Location
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span className="truncate">{vendor?.email || 'operations@airtronic-partner.com'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{vendor?.phone || '+91 98400 12345'}</span>
              </div>
              <div className="col-span-2 flex items-start gap-2 text-slate-600 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <span>{vendor?.address || 'Ambattur Industrial Estate, Chennai, Tamil Nadu'}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Capabilities</div>
              <div className="text-xl font-bold text-slate-900 mt-0.5">
                {capabilities.length}
              </div>
              <div className="text-[10px] text-slate-400">Certified Processes</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Active Custody</div>
              <div className="text-xl font-bold text-blue-600 mt-0.5">
                {activeDcs.length}
              </div>
              <div className="text-[10px] text-slate-400">DCs on Shop Floor</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
              <div className="text-[11px] text-slate-500 font-medium">Closed Inwards</div>
              <div className="text-xl font-bold text-emerald-600 mt-0.5">
                {closedDcs.length}
              </div>
              <div className="text-[10px] text-slate-400">Completed Orders</div>
            </div>
          </div>

          {/* Certified Capabilities */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                Manufacturing Capabilities
              </h3>
              <span className="text-[11px] text-slate-400">{capabilities.length} Processes</span>
            </div>

            {capabilities.length === 0 ? (
              <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-100">
                No process capabilities assigned yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {capabilities.map((cap: any) => (
                  <div key={cap.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                    <div>
                      <div className="font-semibold text-slate-900">{cap.process?.name || cap.processName}</div>
                      <div className="text-[11px] text-slate-400">
                        Lead Time: {cap.leadTimeDays || 5} Days {cap.notes ? `• ${cap.notes}` : ''}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Approved
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Custody Delivery Challans */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                Active Material Custody
              </h3>
              <span className="text-[11px] text-slate-400">{activeDcs.length} Active DC(s)</span>
            </div>

            {activeDcs.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                <p className="text-xs text-slate-600 font-medium">All Deliveries Inwarded</p>
                <p className="text-[11px] text-slate-400">No raw material batches currently pending at this vendor.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activeDcs.map((dc: any) => {
                  const isOverdue =
                    dc.expectedReturnDate && new Date(dc.expectedReturnDate) < new Date();
                  return (
                    <div
                      key={dc.id}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                        isOverdue
                          ? 'bg-red-50/60 border-red-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{dc.challanNumber}</span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.2 rounded bg-red-100 text-red-700 font-bold text-[9px] uppercase">
                              Overdue
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Dispatched: {new Date(dc.dispatchDate || dc.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono text-slate-700 font-medium">
                          Expected: {dc.expectedReturnDate ? new Date(dc.expectedReturnDate).toLocaleDateString() : 'N/A'}
                        </span>
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                          Status: {dc.status}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
}
