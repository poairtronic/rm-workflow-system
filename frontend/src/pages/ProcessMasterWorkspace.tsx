import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { productionProcessApi } from '../services/api';
import type { ProductionProcessDto, CreateProductionProcessDto, UpdateProductionProcessDto } from '../types/process-master.dto';
import { ProcessDirectoryGrid } from '../components/production/ProcessDirectoryGrid';
import { ProcessCreationWizard } from '../components/production/ProcessCreationWizard';
import { ProcessEditView } from '../components/production/ProcessEditView';

export function ProcessMasterWorkspace() {
  const queryClient = useQueryClient();
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<ProductionProcessDto | null>(null);

  // Mocking RBAC rights for demonstration purposes
  const hasAdminRights = true; 

  const { data: processes = [], isLoading: isLoadingProcesses } = useQuery({
    queryKey: ['productionProcesses'],
    queryFn: () => productionProcessApi.getAll(),
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors', 'approved'],
    queryFn: () => productionProcessApi.getVendors(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateProductionProcessDto) => productionProcessApi.create(data),
    onSuccess: () => {
      toast.success('Production process defined successfully.');
      queryClient.invalidateQueries({ queryKey: ['productionProcesses'] });
      setIsWizardOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Validation failed. Please check your inputs.');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductionProcessDto }) => productionProcessApi.update(id, data),
    onSuccess: () => {
      toast.success('Production process updated successfully.');
      queryClient.invalidateQueries({ queryKey: ['productionProcesses'] });
      setIsEditOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Update forbidden or invalid parameters.');
    }
  });

  const handleCreateSubmit = (data: CreateProductionProcessDto) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (id: string, data: UpdateProductionProcessDto) => {
    updateMutation.mutate({ id, data });
  };

  const openEdit = (process: ProductionProcessDto) => {
    setSelectedProcess(process);
    setIsEditOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-6 h-6 text-slate-800" />
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Process Master</h1>
          </div>
          <p className="text-slate-500 text-sm">Define manufacturing routing steps, cycle times, and vendor capabilities.</p>
        </div>
        
        <button
          onClick={() => setIsWizardOpen(true)}
          className="h-10 px-4 flex items-center justify-center gap-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-600 shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Define Process
        </button>
      </div>

      <div className="mt-2">
        <ProcessDirectoryGrid 
          data={processes}
          isLoading={isLoadingProcesses}
          onEdit={openEdit}
        />
      </div>

      {/* Modals & Slide-overs */}
      <ProcessCreationWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSubmit={handleCreateSubmit}
        isPending={createMutation.isPending}
        availableVendors={vendors}
      />

      <ProcessEditView
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        process={selectedProcess}
        onSubmit={handleEditSubmit}
        isPending={updateMutation.isPending}
        hasAdminRights={hasAdminRights}
      />
    </div>
  );
}
