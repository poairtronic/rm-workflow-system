import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, PackageCheck, Loader2, Lock, AlertTriangle, ArrowLeft, X, RotateCcw } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import { vendorMasterApi } from '../services/vendorMaster.service';
import type { DeliveryChallanDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../types/dc-return.dto';
import { ActiveCustodyBoard } from '../components/dispatch/ActiveCustodyBoard';
import { ReconciliationGrid } from '../components/dispatch/ReconciliationGrid';
import { MultiSelectFilter } from '../components/ui';

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
  const [activeDcView, setActiveDcView] = useState<'RECONCILE' | 'CLOSURE'>('RECONCILE');
  const [closureNotes, setClosureNotes] = useState('');
  const [isClosureConfirmed, setIsClosureConfirmed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

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

      // Header matches
      if ((dc.challanNumber || '').toLowerCase().includes(q)) return true;
      if ((dc.dcNumber || '').toLowerCase().includes(q)) return true;
      if ((dc.vendor?.name || '').toLowerCase().includes(q)) return true;
      if ((dc.vendor?.code || '').toLowerCase().includes(q)) return true;
      if ((dc.vendorName || '').toLowerCase().includes(q)) return true;
      if ((dc.destinationEntity || '').toLowerCase().includes(q)) return true;
      if ((dc.sc?.scNumber || '').toLowerCase().includes(q)) return true;
      if ((dc.sc?.purchaseOrder?.poNumber || '').toLowerCase().includes(q)) return true;
      if ((dc.notes || '').toLowerCase().includes(q)) return true;

      // Line items matches
      if (dc.items && Array.isArray(dc.items)) {
        for (const item of dc.items) {
          if ((item.product?.name || '').toLowerCase().includes(q)) return true;
          if ((item.product?.code || '').toLowerCase().includes(q)) return true;
          if ((item.sc?.scNumber || '').toLowerCase().includes(q)) return true;
          if ((item.sc?.purchaseOrder?.poNumber || '').toLowerCase().includes(q)) return true;
          if ((item.bin?.code || '').toLowerCase().includes(q)) return true;
          if ((item.batchNumber || '').toLowerCase().includes(q)) return true;
          if ((item.description || '').toLowerCase().includes(q)) return true;
        }
      }

      return false;
    });
  }, [challans, selectedVendors, searchTerm]);

  const methods = useForm<ProcessDcReturnDto>({
    defaultValues: { items: [] }
  });

  const handleSelectDc = (dc: any) => {
    setSelectedDc(dc);
    setActiveDcView('RECONCILE');
    setClosureNotes('');
    setIsClosureConfirmed(false);
    methods.reset({
      items: (dc.items || []).map((item: any) => ({
        itemId: item.id,
        receivedQuantity: Number(item.quantityDispatched) - Number(item.quantityReturned),
        usableQuantity: Number(item.quantityDispatched) - Number(item.quantityReturned),
        scrapQuantity: 0,
        _isSplit: false,
      }))
    });
  };

  const processReturnMutation = useMutation({
    mutationFn: (data: ProcessDcReturnDto) => {
      if (!selectedDc) throw new Error('No DC selected');
      const payload = {
        actualReceiptDate: new Date().toISOString(),
        verificationRemarks: '',
        items: data.items.map((i: any) => ({
          itemId: i.itemId,
          quantityToReturn: Number(i.receivedQuantity),
        })),
      };
      return deliveryChallanApi.processReturn(selectedDc.id, payload as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans'] });
      toast.success('Return reconciliation processed successfully');
      setSelectedDc(null);
    },
    onError: () => {
      toast.error('Failed to process return. Check variances.');
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

  // DC lifecycle: only allow Return/Close for statuses that have been dispatched
  const canReturn = selectedDc && selectedDc.status !== 'OPEN' && selectedDc.status !== 'CLOSED';
  const canClose = selectedDc && selectedDc.status !== 'OPEN' && selectedDc.status !== 'CLOSED';

  return (
    <div className="max-w-[1600px] mx-auto w-full pb-24">
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
                placeholder="Search across Product, SC #, PO #, Vendor, DC #, Batch, or Notes..."
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
                className="w-full sm:w-auto"
              />

              {(selectedVendors.length > 0 || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedVendors([]);
                    setSearchTerm('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
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
        <ActiveCustodyBoard challans={filteredChallans} onSelect={handleSelectDc} />
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
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
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

          {/* Status warning for OPEN challans */}
          {selectedDc.status === 'OPEN' && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <strong>OPEN challan:</strong> This DC has not been marked as Dispatched. Return and Close
              actions are disabled until the status transitions past OPEN.
            </div>
          )}

          <FormProvider {...methods}>
            <form id="reconciliation-form" onSubmit={methods.handleSubmit(onProcessReturn)}>
              <ReconciliationGrid dc={selectedDc} />
            </form>
          </FormProvider>

          {/* Sticky Action Footer */}
          <div className="fixed bottom-0 left-[260px] right-0 p-4 bg-white border-t border-slate-200 z-20 flex justify-end gap-3 shadow-[0_-4px_6px_-1px_rgb(0,0,0,0.05)]">
            <button
              type="button"
              onClick={() => setActiveDcView('CLOSURE')}
              disabled={!canClose || processReturnMutation.isPending}
              title={!canClose ? 'Challan must be DISPATCHED before closing' : undefined}
              className="px-6 h-10 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Administrative Closure
            </button>
            <button
              type="submit"
              form="reconciliation-form"
              disabled={!canReturn || processReturnMutation.isPending || !methods.formState.isValid}
              title={!canReturn ? 'Challan must be DISPATCHED before returning' : undefined}
              className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processReturnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Reconciliation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
