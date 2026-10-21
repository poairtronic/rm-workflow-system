import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  permissionsApi,
  type SystemModuleDto,
  type UserOverrideItem,
} from '../../services/permissions.service';
import type { UserMasterDto } from '../../types/user-master.dto';
import { Button } from '../ui';
import { X, Shield, RotateCcw, Loader2, Eye, ShieldCheck, ShieldAlert, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';

interface UserAccessDrawerProps {
  user: UserMasterDto | null;
  isOpen: boolean;
  onClose: () => void;
}

type PermissionTier = 'FULL_ACCESS' | 'VIEW' | 'DENY' | 'INHERIT';

export function UserAccessDrawer({ user, isOpen, onClose }: UserAccessDrawerProps) {
  const queryClient = useQueryClient();

  // Selected overrides map: moduleKey -> 'FULL_ACCESS' | 'VIEW' | 'DENY' | 'INHERIT'
  const [overrideState, setOverrideState] = useState<Record<string, PermissionTier>>({});

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
      const initialMap: Record<string, PermissionTier> = {};
      // Default all modules to inherit from role
      for (const m of modules) {
        initialMap[m.moduleKey] = 'INHERIT';
      }
      // Populate existing overrides, mapping legacy GRANT/REVOKE if present
      for (const ov of userPerms.overrides) {
        let mappedTier: PermissionTier = 'FULL_ACCESS';
        if (ov.accessType === 'GRANT' || ov.accessType === 'FULL_ACCESS') {
          mappedTier = 'FULL_ACCESS';
        } else if (ov.accessType === 'VIEW') {
          mappedTier = 'VIEW';
        } else if (ov.accessType === 'REVOKE' || ov.accessType === 'DENY') {
          mappedTier = 'DENY';
        } else if (ov.accessType === 'INHERIT') {
          mappedTier = 'INHERIT';
        }
        initialMap[ov.moduleKey] = mappedTier;
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

  const handleBulkSet = (tier: PermissionTier) => {
    const nextMap: Record<string, PermissionTier> = {};
    for (const m of modules) {
      nextMap[m.moduleKey] = tier;
    }
    setOverrideState(nextMap);
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
        <div className="w-screen max-w-3xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/40 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Custom Module Access Control</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure granular permissions (View / Full Access / Deny) for <strong className="text-slate-800">{user.name}</strong> ({user.email}).
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] bg-slate-200/80 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  Base Role: {roleName}
                </span>
                <span className="text-[11px] text-slate-500">
                  By default, inherits role access. Choose VIEW, FULL ACCESS, or DENY to customize.
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

          {/* Quick Bulk Presets Bar */}
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk Quick Actions:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkSet('INHERIT')}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-medium transition-colors"
                title="Reset all modules to match base role default"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                Reset to Role
              </button>
              <button
                type="button"
                onClick={() => handleBulkSet('VIEW')}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 rounded text-cyan-800 font-medium transition-colors"
                title="Set all modules to View Only"
              >
                <Eye className="w-3 h-3 text-cyan-600" />
                All View Only
              </button>
              <button
                type="button"
                onClick={() => handleBulkSet('FULL_ACCESS')}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-emerald-800 font-medium transition-colors"
                title="Grant Full Access to all modules"
              >
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                All Full Access
              </button>
              <button
                type="button"
                onClick={() => handleBulkSet('DENY')}
                className="flex items-center gap-1 text-[11px] px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded text-rose-800 font-medium transition-colors"
                title="Deny access to all modules"
              >
                <ShieldAlert className="w-3 h-3 text-rose-600" />
                All Deny
              </button>
            </div>
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
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 pb-2 border-b border-slate-100">
                  <span className="flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Role Inherited
                  </span>
                  <span className="flex items-center gap-1.5 text-cyan-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block"></span> View Only
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Full Access
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Denied
                  </span>
                </div>

                {Object.entries(groupedModules).map(([group, groupItems]) => (
                  <div key={group} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 px-1">
                      {group}
                    </h3>
                    <div className="space-y-2.5">
                      {groupItems.map((mod) => {
                        const isRoleAllowed = roleAllowedKeys.has(mod.moduleKey);
                        const currentOverride = overrideState[mod.moduleKey] || 'INHERIT';

                        return (
                          <div
                            key={mod.moduleKey}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                              currentOverride === 'FULL_ACCESS'
                                ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/30'
                                : currentOverride === 'VIEW'
                                ? 'bg-cyan-50/80 border-cyan-300 ring-1 ring-cyan-400/30'
                                : currentOverride === 'DENY'
                                ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-400/30'
                                : isRoleAllowed
                                ? 'bg-white border-blue-200'
                                : 'bg-white/60 border-slate-200 opacity-75'
                            }`}
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-slate-900">{mod.name}</span>
                                {currentOverride === 'FULL_ACCESS' && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    FULL ACCESS
                                  </span>
                                )}
                                {currentOverride === 'VIEW' && (
                                  <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-cyan-600" />
                                    VIEW ONLY
                                  </span>
                                )}
                                {currentOverride === 'DENY' && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                                    DENIED
                                  </span>
                                )}
                                {currentOverride === 'INHERIT' && (
                                  <span
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                      isRoleAllowed
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-200 text-slate-600'
                                    }`}
                                  >
                                    Role Default ({isRoleAllowed ? 'Allowed' : 'Off'})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{mod.description || mod.routePath}</p>
                            </div>

                            {/* 4-State Segmented Controls */}
                            <div className="flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0 shadow-xs">
                              {/* INHERIT / ROLE */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'INHERIT',
                                  }))
                                }
                                className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                  currentOverride === 'INHERIT'
                                    ? 'bg-slate-800 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                                title={`Inherit from ${roleName} (${isRoleAllowed ? 'Role has Access' : 'Role does not have Access'})`}
                              >
                                Role
                              </button>

                              {/* VIEW */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'VIEW',
                                  }))
                                }
                                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                  currentOverride === 'VIEW'
                                    ? 'bg-cyan-600 text-white shadow-xs'
                                    : 'text-cyan-700 hover:bg-cyan-50'
                                }`}
                                title="View Only: User can view and browse this module without modifying data"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>

                              {/* FULL ACCESS */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'FULL_ACCESS',
                                  }))
                                }
                                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                  currentOverride === 'FULL_ACCESS'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title="Full Access: User can view, create, edit and perform full actions"
                              >
                                <ShieldCheck className="w-3 h-3" />
                                Full
                              </button>

                              {/* DENY */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'DENY',
                                  }))
                                }
                                className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded font-medium transition-colors ${
                                  currentOverride === 'DENY'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Deny: Block access completely regardless of role"
                              >
                                <ShieldAlert className="w-3 h-3" />
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
              Changes take effect immediately on next page navigation or login.
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
