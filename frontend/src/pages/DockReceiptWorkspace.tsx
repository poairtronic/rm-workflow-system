import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, PackageCheck, Loader2, Lock, AlertTriangle, ArrowLeft } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import type { DeliveryChallanDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../types/dc-return.dto';
import { ActiveCustodyBoard } from '../components/dispatch/ActiveCustodyBoard';
import { ReconciliationGrid } from '../components/dispatch/ReconciliationGrid';

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

  const { data: challans = [] } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: () => deliveryChallanApi.getAll(),
  });

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
        <div className="mb-6 relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Scan or enter DC Number (e.g., DC-1791190289098)..."
            className="w-full h-12 pl-12 pr-4 rounded-lg bg-white border border-slate-200 text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const found = (challans as any[]).find((dc: any) => dc.challanNumber === searchTerm || dc.dcNumber === searchTerm);
                if (found) {
                  handleSelectDc(found);
                } else {
                  toast.error('DC not found or already closed');
                }
              }
            }}
          />
        </div>
      )}

      {!selectedDc ? (
        <ActiveCustodyBoard challans={challans as any[]} onSelect={handleSelectDc} />
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
