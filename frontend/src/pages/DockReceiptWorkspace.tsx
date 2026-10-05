import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Search, PackageCheck, Loader2 } from 'lucide-react';
import { deliveryChallanApi } from '../services/api';
import type { DeliveryChallanDto, CreateDeliveryChallanItemDto } from '../types/delivery-challan.dto';
import type { ProcessDcReturnDto } from '../types/dc-return.dto';
import { ActiveCustodyBoard } from '../components/dispatch/ActiveCustodyBoard';
import { ReconciliationGrid } from '../components/dispatch/ReconciliationGrid';
import { ChallanClosureModal } from '../components/dispatch/ChallanClosureModal';

export function DockReceiptWorkspace() {
  const queryClient = useQueryClient();
  const [selectedDc, setSelectedDc] = useState<DeliveryChallanDto | null>(null);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all challans
  const { data: challans = [] } = useQuery({
    queryKey: ['delivery-challans'],
    queryFn: () => deliveryChallanApi.getAll(),
  });

  const methods = useForm<ProcessDcReturnDto>({
    defaultValues: { items: [] }
  });

  // Handle select from board or search
  const handleSelectDc = (dc: DeliveryChallanDto) => {
    setSelectedDc(dc);
    // Initialize form state
    methods.reset({
      items: dc.items.map((item: CreateDeliveryChallanItemDto & { id: string }) => ({
        itemId: item.id,
        receivedQuantity: item.quantity,
        usableQuantity: item.quantity,
        scrapQuantity: 0,
      }))
    });
  };

  const processReturnMutation = useMutation({
    mutationFn: (data: ProcessDcReturnDto) => {
      if (!selectedDc) throw new Error('No DC selected');
      return deliveryChallanApi.processReturn(selectedDc.id, data);
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
    processReturnMutation.mutate(data);
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full pb-24">
      {/* Header */}
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

      {/* Dock Receipt Search */}
      <div className="mb-6 relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Scan or enter DC Barcode (e.g., DC-2026-089)..."
          className="w-full h-12 pl-12 pr-4 rounded-lg bg-white border border-slate-200 text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const found = challans.find((dc: DeliveryChallanDto) => dc.dcNumber === searchTerm);
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
        <ActiveCustodyBoard challans={challans} onSelect={handleSelectDc} />
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Processing Return: {selectedDc.dcNumber}</h2>
              <p className="text-sm text-slate-500">Destination: {selectedDc.vendorName || selectedDc.destinationEntity}</p>
            </div>
            <button
              onClick={() => setSelectedDc(null)}
              className="text-sm font-medium text-primary hover:text-primary-secondary"
            >
              Cancel / Select Another
            </button>
          </div>

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
              className="px-6 h-10 bg-white border border-slate-200 text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Administrative Closure
            </button>
            <button
              type="submit"
              form="reconciliation-form"
              disabled={processReturnMutation.isPending || !methods.formState.isValid}
              className="inline-flex items-center gap-2 px-6 h-10 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
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
