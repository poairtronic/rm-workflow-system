import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  permissionsApi,
  type RoleMatrixResponse,
  type SystemModuleDto,
} from '../../services/permissions.service';
import { Button } from '../ui';
import { X, Loader2, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';

interface RolePermissionMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RolePermissionMatrixModal({ isOpen, onClose }: RolePermissionMatrixModalProps) {
  const queryClient = useQueryClient();

  // Local state copy of matrix: roleId -> Set of moduleKeys
  const [matrixState, setMatrixState] = useState<Record<string, Set<string>>>({});
  const [activeRoleTab, setActiveRoleTab] = useState<string>('');

  const {
    data: matrixData,
    isLoading,
  } = useQuery<RoleMatrixResponse>({
    queryKey: ['role-permission-matrix'],
    queryFn: () => permissionsApi.getRoleMatrix(),
    enabled: isOpen,
  });

  useEffect(() => {
    if (matrixData) {
      const state: Record<string, Set<string>> = {};
      for (const [roleId, keys] of Object.entries(matrixData.matrix)) {
        state[roleId] = new Set(keys);
      }
      setMatrixState(state);
      if (!activeRoleTab && matrixData.roles.length > 0) {
        // default to first non-admin role or first role
        const designer = matrixData.roles.find(r => r.name === 'DESIGNER');
        setActiveRoleTab(designer ? designer.id : matrixData.roles[0].id);
      }
    }
  }, [matrixData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = Object.entries(matrixState).map(([roleId, set]) =>
        permissionsApi.updateRolePermissions(roleId, Array.from(set))
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      toast.success('Role access permissions matrix saved successfully');
      queryClient.invalidateQueries({ queryKey: ['role-permission-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save role matrix');
    },
  });

  if (!isOpen) return null;

  const togglePermission = (roleId: string, moduleKey: string) => {
    setMatrixState((prev) => {
      const currentSet = new Set(prev[roleId] || []);
      if (currentSet.has(moduleKey)) {
        currentSet.delete(moduleKey);
      } else {
        currentSet.add(moduleKey);
      }
      return {
        ...prev,
        [roleId]: currentSet,
      };
    });
  };

  const handleSelectAllForRole = (roleId: string) => {
    if (!matrixData) return;
    setMatrixState((prev) => ({
      ...prev,
      [roleId]: new Set(matrixData.modules.map((m) => m.moduleKey)),
    }));
  };

  const handleClearAllForRole = (roleId: string) => {
    setMatrixState((prev) => ({
      ...prev,
      [roleId]: new Set(),
    }));
  };

  const modules = matrixData?.modules || [];
  const roles = matrixData?.roles || [];

  // Group modules
  const groupedModules = modules.reduce((acc, m) => {
    const g = m.groupName || 'GENERAL';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {} as Record<string, SystemModuleDto[]>);

  const activeRole = roles.find((r) => r.id === activeRoleTab);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50/50 via-white to-indigo-50/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">System Role Permission Matrix</h2>
              <p className="text-xs text-slate-500">
                Configure default module access for each role. Users inherit these permissions unless individually customized.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Tabs */}
        <div className="border-b border-slate-200 bg-slate-50/60 px-6 pt-3 flex items-center gap-1.5 overflow-x-auto">
          {roles.map((r) => {
            const count = matrixState[r.id]?.size || 0;
            const isActive = r.id === activeRoleTab;
            return (
              <button
                key={r.id}
                onClick={() => setActiveRoleTab(r.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                  isActive
                    ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span>{r.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count} modules
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <span className="text-sm font-medium">Loading permissions matrix...</span>
            </div>
          ) : activeRole ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs text-slate-600">
                  Configuring default access for <strong className="text-slate-900">{activeRole.name}</strong> role.
                  {activeRole.name === 'ADMIN' && (
                    <span className="ml-2 text-amber-700 font-semibold">(Administrators always retain full access)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectAllForRole(activeRole.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold px-2 py-1 rounded hover:bg-blue-50"
                  >
                    Select All
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => handleClearAllForRole(activeRole.id)}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {Object.entries(groupedModules).map(([group, groupItems]) => (
                <div key={group} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{group}</span>
                    <span className="text-[11px] text-slate-400 font-medium">{groupItems.length} modules</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {groupItems.map((mod) => {
                      const isAllowed = matrixState[activeRole.id]?.has(mod.moduleKey) ?? false;
                      return (
                        <label
                          key={mod.moduleKey}
                          className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/70 cursor-pointer transition-colors"
                        >
                          <div className="pr-4">
                            <span className="font-semibold text-sm text-slate-900">{mod.name}</span>
                            <p className="text-xs text-slate-500 mt-0.5">{mod.description || mod.routePath}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isAllowed}
                            onChange={() => togglePermission(activeRole.id, mod.moduleKey)}
                            disabled={activeRole.name === 'ADMIN' && mod.moduleKey === 'users_master'}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Total {modules.length} modules configured across {roles.length} roles.
          </span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onClose} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isLoading}
            >
              {saveMutation.isPending ? 'Saving Matrix...' : 'Save Role Matrix'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
