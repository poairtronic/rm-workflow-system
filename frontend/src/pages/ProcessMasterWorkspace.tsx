import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Settings, Search, X } from 'lucide-react';
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

  const { data: processes = [], isLoading: isLoadingProcesses, isError, error, refetch } = useQuery({
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

  const [searchTerm, setSearchTerm] = useState('');

  const vendorMap = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((v: any) => {
      map.set(v.id, (v.vendorName || v.name || '').toLowerCase());
    });
    return map;
  }, [vendors]);

  const filteredProcesses = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return processes;

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

    return processes.filter((proc) => {
      if (matchField(proc.nomenclature)) return true;
      if (matchField(proc.internalCode)) return true;
      if (matchField(proc.description)) return true;
      if (matchField(proc.baseUom)) return true;
      if (proc.linkedVendorIds && Array.isArray(proc.linkedVendorIds)) {
        for (const vid of proc.linkedVendorIds) {
          const vName = vendorMap.get(vid);
          if (vName && matchField(vName)) return true;
        }
      }
      return false;
    });
  }, [processes, searchTerm, vendorMap]);

  return (
    <div className="flex flex-col gap-6">
      {isWizardOpen ? (
        <ProcessCreationWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
          onSubmit={handleCreateSubmit}
          isPending={createMutation.isPending}
          availableVendors={vendors}
        />
      ) : isEditOpen ? (
        <ProcessEditView
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          process={selectedProcess}
          onSubmit={handleEditSubmit}
          isPending={updateMutation.isPending}
          hasAdminRights={hasAdminRights}
        />
      ) : (
        <>
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

          {/* In-Page Process Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Process Nomenclature (e.g. Heating, CNC, Milling), Internal Code, or Vendor..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 bg-slate-50/50 focus:bg-white transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchTerm && (
              <span className="text-xs text-slate-500 px-2 shrink-0">
                Found {filteredProcesses.length} of {processes.length} processes
              </span>
            )}
          </div>

          <div className="mt-1">
            {isError ? (
              <div className="p-8 text-center bg-red-50 rounded-xl border border-red-100">
                <p className="text-red-600 font-medium mb-4">{error instanceof Error ? error.message : 'Failed to load processes'}</p>
                <button onClick={() => refetch()} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium">
                  Retry
                </button>
              </div>
            ) : !isLoadingProcesses && processes.length === 0 ? (
              <div className="p-12 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                <Settings className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900 mb-1">No processes defined</h3>
                <p className="text-slate-500 mb-4">Get started by defining your first manufacturing routing step.</p>
                <button onClick={() => setIsWizardOpen(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm">
                  Define Process
                </button>
              </div>
            ) : !isLoadingProcesses && filteredProcesses.length === 0 ? (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800 mb-1">No processes match "{searchTerm}"</h3>
                <p className="text-slate-500 text-xs mb-4">Try searching with a process type like "Heating", "Milling", "Plating", or code "HT".</p>
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-3.5 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Clear Filter
                </button>
              </div>
            ) : (
              <ProcessDirectoryGrid 
                data={filteredProcesses}
                isLoading={isLoadingProcesses}
                onEdit={openEdit}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
