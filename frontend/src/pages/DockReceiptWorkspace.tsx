import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, PackageCheck, Loader2 } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import type { DeliveryChallanDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../types/dc-return.dto';
import { ActiveCustodyBoard } from '../components/dispatch/ActiveCustodyBoard';
import { ReconciliationGrid } from '../components/dispatch/ReconciliationGrid';
import { ChallanClosureModal } from '../components/dispatch/ChallanClosureModal';

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
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
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
      // Map to exact backend DTO: { actualReceiptDate, verificationRemarks, items:[{itemId, quantityToReturn}] }
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

  const onProcessReturn = (data: ProcessDcReturnDto) => {
    if (processReturnMutation.isPending) return; // guard double-submit
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

      {!selectedDc ? (
        <ActiveCustodyBoard challans={challans as any[]} onSelect={handleSelectDc} />
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
              onClick={() => setIsClosureModalOpen(true)}
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

      <ChallanClosureModal
        dc={selectedDc}
        isOpen={isClosureModalOpen}
        onClose={() => setIsClosureModalOpen(false)}
        onSuccess={() => {
          setIsClosureModalOpen(false);
          setSelectedDc(null);
        }}
      />
    </div>
  );
}
