import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Shield, Plus } from 'lucide-react';
import { vendorSlaApi } from '../services/api';
import type { VendorSlaDto, CreateVendorSlaDto, SlaOverrideDto } from '../types/vendor-sla.dto';
import { SlaConfigurationGrid } from '../components/vendor-sla/SlaConfigurationGrid';
import { SlaDefinitionForm } from '../components/vendor-sla/SlaDefinitionForm';
import { AlertSettingsPanel } from '../components/vendor-sla/AlertSettingsPanel';
import { SlaComplianceChart } from '../components/vendor-sla/SlaComplianceChart';
import { SlaOverrideModal } from '../components/vendor-sla/SlaOverrideModal';
import { ErrorState } from '../components/ui/ErrorState';

import { useAuth } from '../contexts/AuthContext';

// Mocking RBAC access for this UI context
const CURRENT_USER_HAS_OVERRIDE_ACCESS = true;

export function VendorSlaWorkspace() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  
  const canSave = currentUser?.role === 'ADMIN' || currentUser?.role === 'STORES';
  
  // Modals & Active State
  const [overrideModalSla, setOverrideModalSla] = useState<VendorSlaDto | null>(null);
  const [selectedVendorForCompliance] = useState<string | null>(null);

  // Data Fetching
  const { data: slas = [], isLoading } = useQuery({
    queryKey: ['vendor-slas'],
    queryFn: async () => {
      const response = await vendorSlaApi.getAll();
      return response;
    }
  });

  // Form Setup
  const methods = useForm<CreateVendorSlaDto>({
    defaultValues: {
      standardTatDays: 5,
      leadTimeMultiplier: 1.0,
      toleranceBufferDays: 1,
      alert24h: true,
      alert48h: false,
      alert72h: false,
      emailAlertsEnabled: true,
      smsAlertsEnabled: false
    }
  });

  // Mutations
  const createSlaMutation = useMutation({
    mutationFn: (data: CreateVendorSlaDto) => vendorSlaApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-slas'] });
      toast.success('SLA definition created successfully');
      methods.reset();
    },
    onError: () => {
      toast.error('Validation Error: Failed to create SLA definition');
    }
  });

  const overrideSlaMutation = useMutation({
    mutationFn: ({ slaId, data }: { slaId: string, data: SlaOverrideDto }) => vendorSlaApi.overrideSla(slaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-slas'] });
      toast.success('SLA exception override applied successfully');
      setOverrideModalSla(null);
    },
    onError: (error: any) => {
      if (error.response?.status === 403) {
        toast.error('Unauthorized Override Attempt');
      } else {
        toast.error('Failed to apply SLA override');
      }
    }
  });

  const onSubmitNewSla = (data: CreateVendorSlaDto) => {
    // We would typically select vendor and process IDs from a dropdown in a real flow.
    // For now, assigning dummy IDs to demonstrate submission.
    createSlaMutation.mutate({
      ...data,
      vendorId: 'VND-DEMO',
      processId: 'PRC-DEMO'
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Vendor SLA Governance
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Establish, monitor, and enforce Service Level Agreements for external manufacturing processes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column - Configuration & Forms */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
          {slas.length === 0 && !isLoading ? (
            <ErrorState message="Failed to load SLAs or no SLAs exist." onRetry={() => queryClient.invalidateQueries({ queryKey: ['vendor-slas'] })} />
          ) : (
            <SlaConfigurationGrid 
              data={slas} 
              isLoading={isLoading} 
            />
          )}

          <FormProvider {...methods}>
            <form id="create-sla-form" onSubmit={methods.handleSubmit(onSubmitNewSla)} className="space-y-6">
              <SlaDefinitionForm />
              <AlertSettingsPanel />
              
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={createSlaMutation.isPending || !canSave}
                  title={!canSave ? "You don't have permission to create SLAs" : undefined}
                  className="inline-flex items-center gap-2 px-6 h-11 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {createSlaMutation.isPending ? 'Saving...' : 'Create SLA Definition'}
                </button>
              </div>
            </form>
          </FormProvider>
        </div>

        {/* Right Column - Compliance View */}
        <div className="col-span-12 xl:col-span-4">
          <div className="sticky top-24">
            {selectedVendorForCompliance ? (
              <SlaComplianceChart vendorId={selectedVendorForCompliance} />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-center h-64 flex flex-col items-center justify-center">
                <Shield className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-sm font-medium text-slate-900">No Vendor Selected</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-[200px]">Select a vendor from the configuration grid to view historical compliance.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <SlaOverrideModal
        isOpen={!!overrideModalSla}
        onClose={() => setOverrideModalSla(null)}
        sla={overrideModalSla}
        hasOverrideAccess={CURRENT_USER_HAS_OVERRIDE_ACCESS}
        onSubmit={(data) => {
          if (overrideModalSla) {
            overrideSlaMutation.mutate({ slaId: overrideModalSla.id, data });
          }
        }}
      />
    </div>
  );
}
