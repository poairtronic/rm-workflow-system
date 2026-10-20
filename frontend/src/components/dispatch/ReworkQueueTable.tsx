import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CheckCircle2,
  Send,
  Loader2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Search,
  Printer,
} from 'lucide-react';
import { deliveryChallanApi } from '../../services/api';
import type { DcReworkItemDto, DeliveryChallanDto } from '../../types/delivery-challan.dto';
import { CreateReworkDcModal } from './CreateReworkDcModal';

interface ReworkQueueTableProps {
  onSelectDc?: (dc: DeliveryChallanDto) => void;
  challans?: DeliveryChallanDto[];
}

export function ReworkQueueTable({ onSelectDc, challans }: ReworkQueueTableProps = {}) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReworkItem, setSelectedReworkItem] = useState<DcReworkItemDto | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: reworkItems = [], isLoading } = useQuery({
    queryKey: ['rework-items'],
    queryFn: () => deliveryChallanApi.getReworkItems(),
  });

  const markOkayMutation = useMutation({
    mutationFn: (id: string) => deliveryChallanApi.markReworkItemOkay(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rework-items'] });
      toast.success('Rework item verified and marked ready for re-dispatch under same SC/PO!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to acknowledge rework item');
    },
  });

  const filteredItems = (reworkItems as DcReworkItemDto[]).filter((item) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      item.sourceDcNumber.toLowerCase().includes(q) ||
      (item.scNumber && item.scNumber.toLowerCase().includes(q)) ||
      (item.poNumber && item.poNumber.toLowerCase().includes(q)) ||
      item.productName.toLowerCase().includes(q) ||
      item.originalVendorName.toLowerCase().includes(q) ||
      (item.qcRemarks && item.qcRemarks.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_ACK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            Pending Ack
          </span>
        );
      case 'MARKED_OKAY':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <ShieldCheck className="w-3 h-3 text-blue-600" />
            Ready for DC
          </span>
        );
      case 'RE_DISPATCHED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Re-Dispatched
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Rework by DC #, SC #, PO #, Vendor, SKU..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Rejected / Rework Items: <strong className="text-slate-800">{filteredItems.length}</strong>
        </div>
      </div>

      {/* Rework Queue Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">Source DC #</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">SC # / PO #</th>
                <th className="px-5 py-3">Item / Material</th>
                <th className="px-5 py-3">Original Vendor</th>
                <th className="px-5 py-3 text-right">Rejected Qty</th>
                <th className="px-5 py-3">QC Failure Remarks</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Loading Rework Queue...
                    </div>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500/80" />
                      <p className="font-semibold text-slate-800 text-sm">Rework Queue Clean</p>
                      <p className="text-xs text-slate-400">No items are currently rejected or awaiting rework.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isType1 = item.dcType === 'PRODUCTION_PROCESS_OUTWARD';
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors h-14">
                      {/* Source DC */}
                      <td className="px-5 py-2 font-mono text-xs font-semibold text-slate-900">
                        {item.sourceDcNumber}
                      </td>

                      {/* Type Badge */}
                      <td className="px-5 py-2">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                          isType1 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isType1 ? 'Type 1 (WIP)' : 'Type 2 (Stock)'}
                        </span>
                      </td>

                      {/* SC # / PO # */}
                      <td className="px-5 py-2 text-xs">
                        {item.scNumber ? (
                          <div className="flex flex-col">
                            <span className="font-mono font-bold text-blue-700">{item.scNumber}</span>
                            {item.poNumber && (
                              <span className="text-[10px] text-slate-400 font-mono">{item.poNumber}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-xs">General / Stock</span>
                        )}
                      </td>

                      {/* Item / Material */}
                      <td className="px-5 py-2 max-w-xs">
                        <p className="font-semibold text-slate-900 text-xs truncate">{item.productName}</p>
                        {item.partNumber && (
                          <p className="text-[11px] text-slate-400 font-mono truncate">{item.partNumber}</p>
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="px-5 py-2 text-xs text-slate-700 font-medium">
                        {item.originalVendorName}
                      </td>

                      {/* Rejected Qty */}
                      <td className="px-5 py-2 text-right tabular-nums">
                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                          {item.rejectedQty} {item.uom}
                        </span>
                      </td>

                      {/* QC Remarks */}
                      <td className="px-5 py-2 text-xs text-slate-600 max-w-xs truncate" title={item.qcRemarks || ''}>
                        {item.qcRemarks || <span className="text-slate-400 italic">None noted</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-2">
                        {getStatusBadge(item.reworkStatus)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-2 text-right">
                        {item.reworkStatus === 'PENDING_ACK' && (
                          <button
                            type="button"
                            onClick={() => markOkayMutation.mutate(item.id)}
                            disabled={markOkayMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                            <span>Mark Okay (Keep in SC)</span>
                          </button>
                        )}

                        {item.reworkStatus === 'MARKED_OKAY' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReworkItem(item);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white hover:bg-primary-secondary rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Create Rework DC</span>
                          </button>
                        )}

                        {item.reworkStatus === 'RE_DISPATCHED' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const found = challans?.find(
                                  (c) => (c.challanNumber || c.dcNumber) === item.reworkDcNumber || c.id === item.reworkDcId
                                );
                                if (found && onSelectDc) {
                                  onSelectDc(found);
                                } else {
                                  toast.success(`Re-dispatched under DC ${item.reworkDcNumber}`);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                              title="Click to view this Rework Delivery Challan"
                            >
                              <ExternalLink className="w-3 h-3 text-emerald-600" />
                              <span>{item.reworkDcNumber || 'Dispatched'}</span>
                            </button>

                            {(item.reworkDcId || item.sourceDcId) && (
                              <button
                                type="button"
                                onClick={() =>
                                  window.open(
                                    `/dispatch/delivery-challan/${item.reworkDcId || item.sourceDcId}/print`,
                                    '_blank'
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                                title="Print Delivery Challan"
                              >
                                <Printer className="w-3.5 h-3.5 text-blue-600" />
                                <span>Print</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* One-Click Rework Re-Dispatch Modal */}
      <CreateReworkDcModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReworkItem(null);
        }}
        reworkItem={selectedReworkItem}
      />
    </div>
  );
}
