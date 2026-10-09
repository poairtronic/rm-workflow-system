import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  permissionsApi,
  type SystemModuleDto,
  type UserOverrideItem,
} from '../../services/permissions.service';
import type { UserMasterDto } from '../../types/user-master.dto';
import { Button } from '../ui';
import { X, Shield, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserAccessDrawerProps {
  user: UserMasterDto | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserAccessDrawer({ user, isOpen, onClose }: UserAccessDrawerProps) {
  const queryClient = useQueryClient();

  // Selected overrides map: moduleKey -> 'GRANT' | 'REVOKE' | 'INHERIT'
  const [overrideState, setOverrideState] = useState<Record<string, 'GRANT' | 'REVOKE' | 'INHERIT'>>({});

  // Fetch modules list
  const { data: modules = [] } = useQuery({
    queryKey: ['system-modules'],
    queryFn: () => permissionsApi.getAllModules(),
    enabled: isOpen,
  });

  // Fetch target user's current permissions
  const {
    data: userPerms,
    isLoading: isLoadingPerms,
  } = useQuery({
    queryKey: ['user-permissions', user?.id],
    queryFn: () => permissionsApi.getUserPermissions(user!.id),
    enabled: isOpen && !!user?.id,
  });

  useEffect(() => {
    if (userPerms) {
      const initialMap: Record<string, 'GRANT' | 'REVOKE' | 'INHERIT'> = {};
      // default all to inherit
      for (const m of modules) {
        initialMap[m.moduleKey] = 'INHERIT';
      }
      // populate existing overrides
      for (const ov of userPerms.overrides) {
        initialMap[ov.moduleKey] = ov.accessType;
      }
      setOverrideState(initialMap);
    }
  }, [userPerms, modules]);

  const updateMutation = useMutation({
    mutationFn: (overrides: UserOverrideItem[]) =>
      permissionsApi.updateUserPermissions(user!.id, overrides),
    onSuccess: () => {
      toast.success(`Access permissions updated for ${user?.name}`);
      queryClient.invalidateQueries({ queryKey: ['user-permissions', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['users-master'] });
      onClose();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update access permissions');
    },
  });

  if (!isOpen || !user) return null;

  const handleSave = () => {
    const payload: UserOverrideItem[] = Object.entries(overrideState).map(([moduleKey, action]) => ({
      moduleKey,
      action,
    }));
    updateMutation.mutate(payload);
  };

  const handleResetAllToRole = () => {
    const resetMap: Record<string, 'GRANT' | 'REVOKE' | 'INHERIT'> = {};
    for (const m of modules) {
      resetMap[m.moduleKey] = 'INHERIT';
    }
    setOverrideState(resetMap);
  };

  // Group modules
  const groupedModules = modules.reduce((acc, m) => {
    const g = m.groupName || 'GENERAL';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {} as Record<string, SystemModuleDto[]>);

  const roleName = user.role?.name || 'DESIGNER';
  const roleAllowedKeys = new Set(userPerms?.roleModules || []);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Custom Module Access Control</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure module visibility for <strong className="text-slate-800">{user.name}</strong> ({user.email}).
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] bg-slate-200/80 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  Base Role: {roleName}
                </span>
                <span className="text-[11px] text-slate-500">
                  Default: Inherits all {roleName} modules. Check specific modules below to grant extra access.
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoadingPerms ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                <span className="text-sm font-medium">Loading user permissions...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5 text-blue-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Inherited from {roleName}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Custom Granted
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Custom Revoked
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetAllToRole}
                    className="flex items-center gap-1 text-xs text-slate-600 hover:text-blue-600 font-medium px-2 py-1 rounded hover:bg-slate-100"
                    title="Reset all modules to match base role default"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset to Role Defaults
                  </button>
                </div>

                {Object.entries(groupedModules).map(([group, groupItems]) => (
                  <div key={group} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 px-1">
                      {group}
                    </h3>
                    <div className="space-y-2">
                      {groupItems.map((mod) => {
                        const isRoleAllowed = roleAllowedKeys.has(mod.moduleKey);
                        const currentOverride = overrideState[mod.moduleKey] || 'INHERIT';

                        return (
                          <div
                            key={mod.moduleKey}
                            className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                              currentOverride === 'GRANT'
                                ? 'bg-emerald-50/80 border-emerald-300'
                                : currentOverride === 'REVOKE'
                                ? 'bg-rose-50/80 border-rose-300'
                                : isRoleAllowed
                                ? 'bg-white border-blue-200'
                                : 'bg-white/60 border-slate-200 opacity-75'
                            }`}
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-slate-900">{mod.name}</span>
                                {currentOverride === 'GRANT' && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                                    CUSTOM GRANT
                                  </span>
                                )}
                                {currentOverride === 'REVOKE' && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                                    CUSTOM REVOKE
                                  </span>
                                )}
                                {currentOverride === 'INHERIT' && isRoleAllowed && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 font-medium px-1.5 py-0.5 rounded">
                                    Role Default
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{mod.description || mod.routePath}</p>
                            </div>

                            {/* 3-State Controls */}
                            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 shadow-sm">
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'INHERIT',
                                  }))
                                }
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                                  currentOverride === 'INHERIT'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title={`Inherit from ${roleName} (${isRoleAllowed ? 'Visible' : 'Hidden'})`}
                              >
                                Role ({isRoleAllowed ? 'On' : 'Off'})
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'GRANT',
                                  }))
                                }
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                                  currentOverride === 'GRANT'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Force Grant Access to this user"
                              >
                                Grant
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'REVOKE',
                                  }))
                                }
                                className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                                  currentOverride === 'REVOKE'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Force Revoke Access for this user"
                              >
                                Deny
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Changes take effect immediately for the user.
            </span>
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={onClose} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={updateMutation.isPending || isLoadingPerms}
              >
                {updateMutation.isPending ? 'Saving Access...' : 'Save User Access'}
              </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
