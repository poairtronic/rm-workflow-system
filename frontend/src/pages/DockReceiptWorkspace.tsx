import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, PackageCheck, Loader2, Lock, AlertTriangle, ArrowLeft, X, RotateCcw, CheckCircle2 } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import { vendorMasterApi } from '../services/vendorMaster.service';
import type { DeliveryChallanDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../types/dc-return.dto';
import { ActiveCustodyBoard } from '../components/dispatch/ActiveCustodyBoard';
import { ReconciliationGrid } from '../components/dispatch/ReconciliationGrid';
import { QcInspectionModal } from '../components/dispatch/QcInspectionModal';
import { MultiSelectFilter } from '../components/ui';
import { ExportDropdown } from '../components/common/ExportDropdown';
import type { ExportColumn } from '../utils/exportUtils';

// Status badge
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'bg-slate-100 text-slate-700',
    DISPATCHED: 'bg-blue-100 text-blue-700',
    PARTIALLY_RETURNED: 'bg-amber-100 text-amber-700',
    RETURNED: 'bg-green-100 text-green-700',
    CLOSED: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-slate-100 text-slate-700'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

export function DockReceiptWorkspace() {
  const queryClient = useQueryClient();
  const [selectedDc, setSelectedDc] = useState<DeliveryChallanDto | null>(null);
  const [selectedQcDc, setSelectedQcDc] = useState<DeliveryChallanDto | null>(null);
  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [activeDcView, setActiveDcView] = useState<'RECONCILE' | 'CLOSURE'>('RECONCILE');
  const [closureNotes, setClosureNotes] = useState('');
  const [isClosureConfirmed, setIsClosureConfirmed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  const handleInspectQc = (dc: DeliveryChallanDto) => {
    setSelectedQcDc(dc);
    setIsQcModalOpen(true);
  };

  const { data: challans = [] } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: () => deliveryChallanApi.getAll(),
  });

  const { data: allVendors = [] } = useQuery({
    queryKey: ['all-vendors-master'],
    queryFn: () => vendorMasterApi.getAll({ isActive: true }),
  });

  const vendorOptions = useMemo(() => {
    const challanCountByVendor = new Map<string, number>();
    (challans as any[]).forEach((dc) => {
      const vId = dc.vendor?.id || dc.vendorId;
      const vName = (dc.vendor?.name || dc.vendorName || dc.vendor?.code || '').toLowerCase();
      if (vId) {
        challanCountByVendor.set(vId, (challanCountByVendor.get(vId) || 0) + 1);
      }
      if (vName) {
        challanCountByVendor.set(vName, (challanCountByVendor.get(vName) || 0) + 1);
      }
    });

    if (allVendors && allVendors.length > 0) {
      return (allVendors as any[])
        .slice()
        .sort((a, b) => {
          const numA = parseInt((a.code || '').replace(/\D/g, ''), 10);
          const numB = parseInt((b.code || '').replace(/\D/g, ''), 10);
          if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
            return numA - numB;
          }
          return (a.name || '').localeCompare(b.name || '');
        })
        .map((v) => {
          const count =
            challanCountByVendor.get(v.id) ||
            challanCountByVendor.get((v.name || '').toLowerCase()) ||
            0;
          return {
            id: v.id,
            label: `${v.code} – ${v.name}`,
            subtext: count > 0 ? `${count} active DC` : undefined,
          };
        });
    }

    const map = new Map<string, { label: string; count: number }>();
    (challans as any[]).forEach((dc) => {
      const vId = dc.vendor?.id || dc.vendorId;
      const vName = dc.vendor?.name || dc.vendorName || dc.vendor?.code || 'Unknown Vendor';
      if (vId) {
        const existing = map.get(vId) || { label: vName, count: 0 };
        existing.count += 1;
        map.set(vId, existing);
      }
    });
    return Array.from(map.entries())
      .map(([id, data]) => ({
        id,
        label: data.label,
        subtext: data.count > 0 ? `${data.count} active DC` : undefined,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allVendors, challans]);

  const filteredChallans = useMemo(() => {
    return (challans as any[]).filter((dc) => {
      // 1. Multi-select Vendor filter
      if (selectedVendors.length > 0) {
        const vId = dc.vendor?.id || dc.vendorId;
        const vName = (dc.vendor?.name || dc.vendorName || '').toLowerCase();
        const vCode = (dc.vendor?.code || '').toLowerCase();
        const matchesVendor =
          selectedVendors.includes(vId) ||
          selectedVendors.some((sv) => {
            const vendorObj = (allVendors as any[]).find((v) => v.id === sv);
            if (vendorObj) {
              return (
                vId === vendorObj.id ||
                vName === (vendorObj.name || '').toLowerCase() ||
                vCode === (vendorObj.code || '').toLowerCase() ||
                vName.includes((vendorObj.name || '').toLowerCase())
              );
            }
            return vName.includes(sv.toLowerCase());
          });
        if (!matchesVendor) return false;
      }

      // 2. Universal Search Term filter
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;

      const tokens = q.split(/\s+/).filter(Boolean);
      const matchField = (fieldVal?: string | null) => {
        if (!fieldVal) return false;
        const val = fieldVal.toLowerCase();
        if (val.includes(q)) return true;
        return tokens.some((t) => {
          if (val.includes(t)) return true;
          if (t.endsWith('ing') && t.length > 4 && val.includes(t.slice(0, -3))) return true;
          if (t.endsWith('ed') && t.length > 4 && val.includes(t.slice(0, -2))) return true;
          if (t === 'heating' && (val.includes('heat') || val.includes('ht'))) return true;
          if (t === 'ht' && val.includes('heat')) return true;
          return false;
        });
      };

      // Header matches (DC #, Vendor, Notes, Process, SC, PO)
      if (matchField(dc.challanNumber)) return true;
      if (matchField(dc.dcNumber)) return true;
      if (matchField(dc.vendor?.name)) return true;
      if (matchField(dc.vendor?.code)) return true;
      if (matchField(dc.vendorName)) return true;
      if (matchField(dc.destinationEntity)) return true;
      if (matchField(dc.sc?.scNumber)) return true;
      if (matchField(dc.sc?.productName)) return true;
      if (matchField(dc.sc?.purchaseOrder?.poNumber)) return true;
      if (matchField(dc.notes)) return true;
      if (matchField(dc.processName)) return true;
      if (matchField(dc.process?.name)) return true;
      if (matchField(dc.process?.nomenclature)) return true;

      // Line items matches (Part Number, Part Name, Product Name/Code, Process, Batch, Description)
      if (dc.items && Array.isArray(dc.items)) {
        for (const item of dc.items) {
          if (matchField(item.partNumber || item.part_number)) return true;
          if (matchField(item.partName || item.part_name)) return true;
          if (matchField(item.product?.name)) return true;
          if (matchField(item.product?.code)) return true;
          if (matchField(item.productName)) return true;
          if (matchField(item.process?.name)) return true;
          if (matchField(item.process?.nomenclature)) return true;
          if (matchField(item.processName)) return true;
          if (matchField(item.sc?.scNumber)) return true;
          if (matchField(item.sc?.productName)) return true;
          if (matchField(item.sc?.purchaseOrder?.poNumber)) return true;
          if (matchField(item.bin?.code)) return true;
          if (matchField(item.batchNumber)) return true;
          if (matchField(item.description)) return true;
        }
      }

      // Grouped line items matches (Type 1 grouped DC structures)
      if (dc.groups && Array.isArray(dc.groups)) {
        for (const group of dc.groups) {
          if (matchField(group.process?.name)) return true;
          if (matchField(group.process?.nomenclature)) return true;
          if (matchField(group.processName)) return true;
          if (group.items && Array.isArray(group.items)) {
            for (const item of group.items) {
              if (matchField(item.partNumber || item.part_number)) return true;
              if (matchField(item.partName || item.part_name)) return true;
              if (matchField(item.productName)) return true;
              if (matchField(item.productCode)) return true;
              if (matchField(item.description)) return true;
            }
          }
        }
      }

      return false;
    });
  }, [challans, selectedVendors, searchTerm, allVendors]);

  const methods = useForm<ProcessDcReturnDto>({
    defaultValues: { items: [] }
  });

  const handleSelectDc = (dc: any) => {
    setSelectedDc(dc);
    setActiveDcView('RECONCILE');
    setClosureNotes('');
    setIsClosureConfirmed(false);
    const isType1 = dc.type === 'PRODUCTION_PROCESS_OUTWARD';
    methods.reset({
      items: (dc.items || []).map((item: any) => {
        const expected = !isType1
          ? Number(item.expectedReturnQty ?? item.expectedOutputQuantity ?? item.quantityDispatched)
          : Number(item.quantityDispatched);
        const alreadyAccounted =
          Number(item.qcPendingQty || 0) +
          Number(item.qcPassedQty || 0) +
          Number(item.qcRejectedQty || 0);
        const remaining = Math.max(0, expected - alreadyAccounted);
        return {
          itemId: item.id,
          expectedReturnQty: expected,
          expectedOutputQuantity: expected,
          returnedProductId: item.outputProductId || item.productId,
          destinationBinId: item.outputBinId || item.binId || '',
          receivedQuantity: remaining,
          actualReceivedQty: Number(item.actualReceivedQty || expected || remaining),
          usableQuantity: remaining,
          scrapQuantity: 0,
          _isSplit: false,
        };
      })
    });
  };

  const processReturnMutation = useMutation({
    mutationFn: (data: ProcessDcReturnDto) => {
      if (!selectedDc) throw new Error('No DC selected');
      const itemsToReturn = data.items
        .filter((i: any) => Number(i.receivedQuantity) > 0)
        .map((i: any) => ({
          itemId: i.itemId,
          expectedReturnQty: i.expectedReturnQty !== undefined && i.expectedReturnQty !== null ? Number(i.expectedReturnQty) : undefined,
          expectedOutputQuantity: i.expectedReturnQty !== undefined && i.expectedReturnQty !== null ? Number(i.expectedReturnQty) : undefined,
          quantityToReturn: Number(i.receivedQuantity),
          receivedQuantity: Number(i.receivedQuantity),
          returnedProductId: i.returnedProductId || undefined,
          destinationBinId: i.destinationBinId || undefined,
          targetBinId: i.destinationBinId || undefined,
          actualReceivedQty: i.actualReceivedQty !== undefined ? Number(i.actualReceivedQty) : Number(i.receivedQuantity),
          actualInwardQty: i.actualReceivedQty !== undefined ? Number(i.actualReceivedQty) : Number(i.receivedQuantity),
        }));

      if (itemsToReturn.length === 0) {
        toast.error('No items with remaining quantity to return.');
        throw new Error('No items to return');
      }

      const payload = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: '',
        items: itemsToReturn,
      };
      return deliveryChallanApi.processReturn(selectedDc.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      queryClient.invalidateQueries({ queryKey: ['rework-items'] });
      toast.success('Dock receipt logged! Material sent to Quality Check (QC Pending).');
      setSelectedDc(null);
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message;
      if (Array.isArray(msg)) {
        toast.error(msg.join(', '));
      } else if (typeof msg === 'string') {
        toast.error(msg);
      } else {
        toast.error('Failed to process return. Check variances.');
      }
    }
  });

  const closeDcMutation = useMutation({
    mutationFn: () => {
      if (!selectedDc) throw new Error('No DC selected');
      return deliveryChallanApi.close(selectedDc.id, { closureNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success(`Delivery Challan ${selectedDc?.challanNumber || selectedDc?.dcNumber} permanently closed.`);
      setSelectedDc(null);
      setActiveDcView('RECONCILE');
      setClosureNotes('');
      setIsClosureConfirmed(false);
    },
    onError: (error: any) => {
      const status = error.response?.status;
      if (status === 403) {
        toast.error('Unauthorized closure attempt', { style: { background: '#FEF2F2', color: '#B91C1C' } });
      } else {
        toast.error('Failed to close Delivery Challan');
      }
    }
  });

  const onProcessReturn = (data: ProcessDcReturnDto) => {
    if (processReturnMutation.isPending) return;
    processReturnMutation.mutate(data);
  };

  // DC lifecycle: allow Return/Close for active statuses (dispatched, open, partially returned)
  const isClosed = selectedDc?.status === 'CLOSED' || selectedDc?.status === 'RETURNED';
  const hasRemainingItems = (selectedDc?.items || []).some((item: any) => {
    const isType1 = selectedDc?.type === 'PRODUCTION_PROCESS_OUTWARD';
    const expected = !isType1
      ? Number(item.expectedReturnQty ?? item.expectedOutputQuantity ?? item.quantityDispatched)
      : Number(item.quantityDispatched);
    const alreadyAccounted =
      Number(item.qcPendingQty || 0) +
      Number(item.qcPassedQty || 0) +
      Number(item.qcRejectedQty || 0);
    return expected > alreadyAccounted;
  });
  const canReturn = selectedDc && !isClosed && hasRemainingItems;
  const canClose = selectedDc && !isClosed;

  const exportDcColumns: ExportColumn<any>[] = [
    { header: 'DC Number', accessor: (dc) => dc.challanNumber || dc.dcNumber || 'N/A' },
    {
      header: 'Date of Creation',
      accessor: (dc) => {
        const raw = dc.createdAt || dc.created_at;
        if (!raw) return 'N/A';
        const d = new Date(raw);
        return !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A';
      },
    },
    { header: 'Status', accessor: (dc) => (dc.status || '').replace('_', ' ') },
    {
      header: 'DC Type',
      accessor: (dc) =>
        dc.type === 'PRODUCTION_PROCESS_OUTWARD'
          ? 'Type 1 (Process)'
          : dc.type === 'GENERAL_INVENTORY_OUTWARD'
          ? 'Type 2 (General)'
          : (dc.type || '').replace(/_/g, ' '),
    },
    { header: 'Vendor / Destination', accessor: (dc) => dc.vendor?.name || dc.vendorName || dc.destinationEntity || 'N/A' },
    {
      header: 'Items & Materials',
      accessor: (dc) => {
        if (dc.items && Array.isArray(dc.items) && dc.items.length > 0) {
          return dc.items
            .map(
              (i: any) =>
                `${i.partNumber ? `[${i.partNumber}] ` : ''}${i.partName || i.productName || i.product?.name || 'Item'} (${Math.abs(
                  Number(i.quantityDispatched ?? i.quantity ?? 0)
                )} ${i.uom || ''})`
            )
            .join('; ');
        }
        return 'N/A';
      },
    },
    {
      header: 'Issue Date',
      accessor: (dc) => {
        const raw = dc.dispatchDate || dc.issueDate;
        if (!raw) return 'N/A';
        const d = new Date(raw);
        return !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A';
      },
    },
    {
      header: 'Target Return',
      accessor: (dc) => {
        const raw = dc.expectedReturnDate;
        if (!raw) return 'N/A';
        const d = new Date(raw);
        return !isNaN(d.getTime())
          ? d.toLocaleDateString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'N/A';
      },
    },
    {
      header: 'SLA Status',
      accessor: (dc) => {
        if (dc.status === 'CLOSED' || dc.status === 'RETURNED') return 'Closed';
        if (!dc.expectedReturnDate) return 'No SLA';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dc.expectedReturnDate);
        target.setHours(0, 0, 0, 0);
        const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diff < 0 ? 'Overdue' : diff === 0 ? 'Due Today' : 'On Track';
      },
    },
  ];

  return (
    <div className="w-full pb-24 space-y-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PackageCheck className="w-6 h-6 text-primary" />
            DC Returns & Reconciliation
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Inward returning materials, reconcile variances, and close Delivery Challans.
          </p>
        </div>
      </div>

      {!selectedDc && (
        <div className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Part #, Product Name, Vendor, Process Type (e.g. Heating), DC #, SC #..."
                className="w-full h-11 pl-10 pr-9 rounded-lg bg-white border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (filteredChallans.length === 1) {
                      handleSelectDc(filteredChallans[0]);
                    } else {
                      const found = (challans as any[]).find(
                        (dc: any) =>
                          dc.challanNumber?.toLowerCase() === searchTerm.toLowerCase() ||
                          dc.dcNumber?.toLowerCase() === searchTerm.toLowerCase()
                      );
                      if (found) {
                        handleSelectDc(found);
                      } else if (filteredChallans.length > 0) {
                        handleSelectDc(filteredChallans[0]);
                      } else {
                        toast.error('DC not found or already closed');
                      }
                    }
                  }
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <MultiSelectFilter
                label="Vendors"
                options={vendorOptions}
                selectedValues={selectedVendors}
                onChange={setSelectedVendors}
                placeholder="Filter by Vendor..."
                align="right"
                className="w-full sm:w-auto"
              />

              <ExportDropdown
                data={filteredChallans}
                columns={exportDcColumns}
                fileName="DC_Returns_Custody_Board"
                reportTitle="DC Returns & Active Custody Board"
                reportSubtitle={`Showing ${filteredChallans.length} delivery challans`}
                metadata={{
                  'Total Challans': filteredChallans.length,
                  'Vendor Filter': selectedVendors.length ? `${selectedVendors.length} filtered` : 'All Vendors',
                  Search: searchTerm || 'All',
                }}
              />

              {(selectedVendors.length > 0 || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVendors([]);
                    setSearchTerm('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
                  title="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <span className="font-semibold text-slate-800">{filteredChallans.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{(challans as any[]).length}</span> delivery challans
            </span>
            {selectedVendors.length > 0 && (
              <span className="text-primary font-medium">
                {selectedVendors.length} vendor{selectedVendors.length > 1 ? 's' : ''} filtered
              </span>
            )}
          </div>
        </div>
      )}

      {!selectedDc ? (
        <ActiveCustodyBoard
          challans={filteredChallans}
          onSelect={handleSelectDc}
          onInspectQc={handleInspectQc}
        />
      ) : activeDcView === 'CLOSURE' ? (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setActiveDcView('RECONCILE')}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-lg border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Reconciliation Grid</span>
            </button>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              Administrative Closure Protocol
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Administrative Closure — {selectedDc.challanNumber || selectedDc.dcNumber}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Vendor: {selectedDc.vendor?.name || selectedDc.vendorName || selectedDc.vendorId}
                  </p>
                </div>
              </div>
              <StatusBadge status={selectedDc.status} />
            </div>

            <div className="bg-amber-50 border-b border-amber-200 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Immutable Ledger Action</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Closing this challan is a permanent action. All variances will be locked, and no further returns or scrap allocations can be made against DC #{selectedDc.challanNumber || selectedDc.dcNumber}.
                </p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Closure Notes / Variance Justification
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Enter final remarks or justification for closing this challan..."
                  rows={3}
                  className="w-full p-3.5 rounded-lg bg-white border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm resize-none"
                />
              </div>

              <label className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
                <div className="flex items-center h-5">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    checked={isClosureConfirmed}
                    onChange={(e) => setIsClosureConfirmed(e.target.checked)}
                  />
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-slate-900 block">I verify all material variances are accounted for.</span>
                  <span className="text-slate-500 text-xs">This electronic signature executes the closure protocol.</span>
                </div>
              </label>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setActiveDcView('RECONCILE')}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => closeDcMutation.mutate()}
                disabled={!isClosureConfirmed || closeDcMutation.isPending}
                className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {closeDcMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {closeDcMutation.isPending ? 'Closing...' : 'Sign & Close Challan'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">
                  Processing Return: {selectedDc.challanNumber || selectedDc.dcNumber}
                </h2>
                <StatusBadge status={selectedDc.status} />
              </div>
              <p className="text-sm text-slate-500">
                Vendor: {selectedDc.vendor?.name || selectedDc.vendorName || selectedDc.vendorId}
              </p>
            </div>
            <button
              onClick={() => setSelectedDc(null)}
              className="text-sm font-medium text-primary hover:text-primary-secondary"
            >
              Cancel / Select Another
            </button>
          </div>

          {/* Status banner for CLOSED challans */}
          {isClosed && (
            <div className="mb-4 p-4 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-900">Delivery Challan Closed / Completed</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All materials for this challan have been inwarded and reconciled. This record is finalized.
                  </p>
                </div>
              </div>
            </div>
          )}

          <FormProvider {...methods}>
            <form id="reconciliation-form" onSubmit={methods.handleSubmit(onProcessReturn)}>
              <ReconciliationGrid dc={selectedDc} isReadOnly={isClosed} />
            </form>
          </FormProvider>

          {/* Sticky Action Footer */}
          {isClosed ? (
            <div className="fixed bottom-0 left-65 right-0 p-4 bg-white border-t border-slate-200 z-20 flex justify-between items-center px-8 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Closed Record — Read-Only Mode
              </span>
              <button
                type="button"
                onClick={() => setSelectedDc(null)}
                className="px-6 h-10 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm"
              >
                Back to Custody Board
              </button>
            </div>
          ) : (
            <div className="fixed bottom-0 left-65 right-0 p-4 bg-white border-t border-slate-200 z-20 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
              <button
                type="button"
                onClick={() => setActiveDcView('CLOSURE')}
                disabled={!canClose || processReturnMutation.isPending}
                className="px-6 h-10 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Administrative Closure
              </button>
              <button
                type="submit"
                form="reconciliation-form"
                disabled={!canReturn || processReturnMutation.isPending || !methods.formState.isValid}
                className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processReturnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Log Return & Send to Quality Check
              </button>
            </div>
          )}
        </div>
      )}

      {/* QC Gate Inspection Modal */}
      <QcInspectionModal
        isOpen={isQcModalOpen}
        onClose={() => {
          setIsQcModalOpen(false);
          setSelectedQcDc(null);
        }}
        dc={selectedQcDc}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
          queryClient.invalidateQueries({ queryKey: ['rework-items'] });
        }}
      />
    </div>
  );
}
