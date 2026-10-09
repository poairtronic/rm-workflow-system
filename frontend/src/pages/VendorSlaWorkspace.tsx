import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Shield, Plus, Scale, ListFilter } from 'lucide-react';
import { vendorSlaApi } from '../services/api';
import type { VendorSlaDto, CreateVendorSlaDto, SlaOverrideDto } from '../types/vendor-sla.dto';
import { SlaConfigurationGrid } from '../components/vendor-sla/SlaConfigurationGrid';
import { SlaDefinitionForm } from '../components/vendor-sla/SlaDefinitionForm';
import { AlertSettingsPanel } from '../components/vendor-sla/AlertSettingsPanel';
import { SlaComplianceChart } from '../components/vendor-sla/SlaComplianceChart';
import { SlaOverrideModal } from '../components/vendor-sla/SlaOverrideModal';
import { VendorComparisonView } from '../components/vendor-sla/VendorComparisonView';
import { VendorDetailDrawer } from '../components/vendor-sla/VendorDetailDrawer';
import { ErrorState } from '../components/ui/ErrorState';
import { useAuth } from '../contexts/AuthContext';

export function VendorSlaWorkspace() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();

  const canSave = currentUser?.role === 'ADMIN' || currentUser?.role === 'STORES' || currentUser?.role === 'GENERAL_MANAGER';
  const hasOverrideAccess = currentUser?.role === 'ADMIN' || currentUser?.role === 'SENIOR_MANAGER' || currentUser?.role === 'GENERAL_MANAGER';

  // Active Tab
  const [activeTab, setActiveTab] = useState<'matrix' | 'compare'>('matrix');

  // Modals & Active Drawer State
  const [overrideModalSla, setOverrideModalSla] = useState<VendorSlaDto | null>(null);
  const [selectedVendorForCompliance, setSelectedVendorForCompliance] = useState<string | null>(null);
  const [selectedVendorName, setSelectedVendorName] = useState<string | null>(null);
  const [dossierVendorId, setDossierVendorId] = useState<string | null>(null);

  // Data Fetching: All SLAs
  const { data: slas = [], isLoading } = useQuery({
    queryKey: ['vendor-slas'],
    queryFn: async () => {
      const response = await vendorSlaApi.getAll();
      return response;
    },
  });

  // Auto-select first vendor for compliance chart when data loads if none selected
  useEffect(() => {
    if (!selectedVendorForCompliance && slas.length > 0) {
      setSelectedVendorForCompliance(slas[0].vendorId);
      setSelectedVendorName(slas[0].vendorName);
    }
  }, [slas, selectedVendorForCompliance]);

  // Form Setup for new SLA
  const methods = useForm<CreateVendorSlaDto>({
    defaultValues: {
      vendorId: '',
      processId: '',
      standardTatDays: 5,
      leadTimeMultiplier: 1.0,
      toleranceBufferDays: 1,
      alert24h: true,
      alert48h: false,
      alert72h: false,
      emailAlertsEnabled: true,
      smsAlertsEnabled: false,
    },
  });

  // Mutations
  const createSlaMutation = useMutation({
    mutationFn: (data: CreateVendorSlaDto) => vendorSlaApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-slas'] });
      queryClient.invalidateQueries({ queryKey: ['compare-vendors-by-process'] });
      toast.success('SLA definition created successfully');
      methods.reset();
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to create SLA definition');
    },
  });

  const overrideSlaMutation = useMutation({
    mutationFn: ({ slaId, data }: { slaId: string; data: SlaOverrideDto }) =>
      vendorSlaApi.overrideSla(slaId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-slas'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-compliance'] });
      toast.success('SLA exception override applied successfully');
      setOverrideModalSla(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to apply SLA override');
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ slaId, isActive }: { slaId: string; isActive: boolean }) =>
      vendorSlaApi.updateSla(slaId, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-slas'] });
      toast.success('SLA status updated');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to toggle SLA status');
    },
  });

  const onSubmitNewSla = (data: CreateVendorSlaDto) => {
    if (!data.vendorId || !data.processId) {
      toast.error('Please select both a Vendor and a Process');
      return;
    }
    createSlaMutation.mutate(data);
  };

  return (
    <div className="max-w-[1600px] mx-auto w-full pb-20">
      {/* Workspace Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-primary" />
            Vendor SLA Governance & Benchmarks
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Establish, monitor, and enforce Service Level Agreements with multi-vendor performance comparisons.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'matrix'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span>SLA Matrix & Setup</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('compare')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'compare'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-blue-600" />
            <span>Multi-Vendor Comparison</span>
          </button>
        </div>
      </div>

      {/* SLA Exception Override Modal */}
      {overrideModalSla && (
        <SlaOverrideModal
          isOpen={!!overrideModalSla}
          onClose={() => setOverrideModalSla(null)}
          sla={overrideModalSla}
          hasOverrideAccess={hasOverrideAccess}
          onSubmit={(data) => {
            if (overrideModalSla) {
              overrideSlaMutation.mutate({ slaId: overrideModalSla.id, data });
            }
          }}
        />
      )}

      {/* Deep Vendor Dossier Drawer */}
      <VendorDetailDrawer
        vendorId={dossierVendorId}
        onClose={() => setDossierVendorId(null)}
      />

      {/* Tab 1: SLA Matrix & Governance */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-12 gap-8">
          {/* Left Column: Grid + Creation Form */}
          <div className="col-span-12 xl:col-span-8 space-y-8">
            {slas.length === 0 && !isLoading ? (
              <ErrorState
                message="Failed to load SLAs or no SLAs exist."
                onRetry={() => queryClient.invalidateQueries({ queryKey: ['vendor-slas'] })}
              />
            ) : (
              <SlaConfigurationGrid
                data={slas}
                isLoading={isLoading}
                selectedVendorId={selectedVendorForCompliance}
                onSelectVendor={(vId, vName) => {
                  setSelectedVendorForCompliance(vId);
                  if (vName) setSelectedVendorName(vName);
                }}
                onOpenOverride={(sla) => setOverrideModalSla(sla)}
                onToggleActive={(sla) =>
                  toggleActiveMutation.mutate({ slaId: sla.id, isActive: !sla.isActive })
                }
                onViewDetails={(vId) => setDossierVendorId(vId)}
              />
            )}

            {/* SLA Creation Form */}
            <FormProvider {...methods}>
              <form
                id="create-sla-form"
                onSubmit={methods.handleSubmit(onSubmitNewSla)}
                className="space-y-6"
              >
                <SlaDefinitionForm />
                <AlertSettingsPanel />

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={createSlaMutation.isPending || !canSave}
                    title={!canSave ? "You don't have permission to create SLAs" : undefined}
                    className="inline-flex items-center gap-2 px-6 h-11 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    {createSlaMutation.isPending ? 'Saving...' : 'Create SLA Definition'}
                  </button>
                </div>
              </form>
            </FormProvider>
          </div>

          {/* Right Column: Historical Compliance Trend */}
          <div className="col-span-12 xl:col-span-4">
            <div className="sticky top-24 space-y-6">
              {selectedVendorForCompliance ? (
                <SlaComplianceChart
                  vendorId={selectedVendorForCompliance}
                  vendorName={selectedVendorName || undefined}
                  onClearSelection={() => {
                    setSelectedVendorForCompliance(null);
                    setSelectedVendorName(null);
                  }}
                />
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center h-72 flex flex-col items-center justify-center">
                  <Shield className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-sm font-semibold text-slate-900">No Vendor Selected</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                    Click any row or &ldquo;Compliance&rdquo; button in the SLA matrix to view historical performance.
                  </p>
                </div>
              )}

              {selectedVendorForCompliance && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center justify-between">
                  <div className="text-xs">
                    <span className="text-slate-500">Need full intelligence?</span>
                    <p className="font-semibold text-slate-800">Inspect vendor capabilities & shop floor custody</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDossierVendorId(selectedVendorForCompliance)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    Open Dossier
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Multi-Vendor Comparative Benchmarks */}
      {activeTab === 'compare' && (
        <VendorComparisonView
          onSelectVendorForCompliance={(vId, vName) => {
            setSelectedVendorForCompliance(vId);
            setSelectedVendorName(vName);
            setActiveTab('matrix');
          }}
          onViewVendorDossier={(vId) => setDossierVendorId(vId)}
        />
      )}
    </div>
  );
}
