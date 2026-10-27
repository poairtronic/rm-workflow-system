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

export type PermissionTier = 'VIEW' | 'FULL_ACCESS' | 'DENY';

export function UserAccessDrawer({ user, isOpen, onClose }: UserAccessDrawerProps) {
  const queryClient = useQueryClient();

  // Selected overrides map: moduleKey -> 'VIEW' | 'FULL_ACCESS' | 'DENY'
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
    if (userPerms && modules.length > 0) {
      const initialMap: Record<string, PermissionTier> = {};
      const roleAllowedKeys = new Set(userPerms.roleModules || []);
      const overridesMap = new Map<string, string>();
      for (const ov of userPerms.overrides || []) {
        overridesMap.set(ov.moduleKey, ov.accessType);
      }

      for (const m of modules) {
        if (overridesMap.has(m.moduleKey)) {
          const ovType = overridesMap.get(m.moduleKey);
          if (ovType === 'VIEW') {
            initialMap[m.moduleKey] = 'VIEW';
          } else if (ovType === 'DENY' || ovType === 'REVOKE') {
            initialMap[m.moduleKey] = 'DENY';
          } else {
            initialMap[m.moduleKey] = 'FULL_ACCESS';
          }
        } else if (userPerms.permissionsMap && userPerms.permissionsMap[m.moduleKey]) {
          const p = userPerms.permissionsMap[m.moduleKey];
          initialMap[m.moduleKey] = p === 'VIEW' ? 'VIEW' : p === 'DENY' ? 'DENY' : 'FULL_ACCESS';
        } else {
          // If role allows, default to FULL_ACCESS, else DENY
          initialMap[m.moduleKey] = roleAllowedKeys.has(m.moduleKey) ? 'FULL_ACCESS' : 'DENY';
        }
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

  const handleResetRoleDefaults = () => {
    const roleAllowedKeys = new Set(userPerms?.roleModules || []);
    const nextMap: Record<string, PermissionTier> = {};
    for (const m of modules) {
      nextMap[m.moduleKey] = roleAllowedKeys.has(m.moduleKey) ? 'FULL_ACCESS' : 'DENY';
    }
    setOverrideState(nextMap);
    toast.success('Reset to Base Role defaults');
  };

  // Group modules
  const groupedModules = modules.reduce((acc, m) => {
    const g = m.groupName || 'GENERAL';
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {} as Record<string, SystemModuleDto[]>);

  const roleName = user.role?.name || 'DESIGNER';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-3xl bg-white shadow-2xl flex flex-col border-l border-slate-200">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Custom Module Access Control</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure module access for <strong className="text-slate-800">{user.name}</strong> ({user.email}).
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[11px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded">
                  Base Role: {roleName}
                </span>
                <span className="text-[11px] text-slate-600">
                  Select 1 of 3 options for each page: <strong>View</strong>, <strong>Full Access</strong>, or <strong>Deny</strong>.
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 3 Clear Explanations Banner */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-2 p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-blue-900">
              <Eye className="w-4 h-4 text-blue-600 shrink-0" />
              <div>
                <span className="font-bold block">1. View</span>
                <span className="text-[11px] text-blue-700">Can view only (no edit)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">2. Full Access</span>
                <span className="text-[11px] text-emerald-700">Can edit, create & delete</span>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 bg-rose-50/80 border border-rose-200 rounded-lg text-rose-900">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <div>
                <span className="font-bold block">3. Deny</span>
                <span className="text-[11px] text-rose-700">Not visible in menu/hidden</span>
              </div>
            </div>
          </div>

          {/* Quick Bulk Presets Bar */}
          <div className="px-6 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-slate-600 font-semibold">
              <Sliders className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk Set All:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleBulkSet('VIEW')}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md text-blue-700 font-semibold transition-colors shadow-xs"
                title="Set all modules to View Only"
              >
                <Eye className="w-3.5 h-3.5" />
                All View
              </button>
              <button
                type="button"
                onClick={() => handleBulkSet('FULL_ACCESS')}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md text-emerald-700 font-semibold transition-colors shadow-xs"
                title="Grant Full Access to all modules"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                All Full Access
              </button>
              <button
                type="button"
                onClick={() => handleBulkSet('DENY')}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md text-rose-700 font-semibold transition-colors shadow-xs"
                title="Deny / Hide all modules"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                All Deny
              </button>
              <button
                type="button"
                onClick={handleResetRoleDefaults}
                className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md text-slate-700 font-medium transition-colors"
                title="Reset to base role default permissions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Role Defaults
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
                {Object.entries(groupedModules).map(([group, groupItems]) => (
                  <div key={group} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 px-1">
                      {group}
                    </h3>
                    <div className="space-y-2.5">
                      {groupItems.map((mod) => {
                        const currentTier: PermissionTier = overrideState[mod.moduleKey] || 'DENY';

                        return (
                          <div
                            key={mod.moduleKey}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-3 transition-all ${
                              currentTier === 'FULL_ACCESS'
                                ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400/30'
                                : currentTier === 'VIEW'
                                ? 'bg-blue-50/80 border-blue-300 ring-1 ring-blue-400/30'
                                : 'bg-slate-50/60 border-slate-200 opacity-80'
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm text-slate-900">{mod.name}</span>
                                {currentTier === 'FULL_ACCESS' && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                    FULL ACCESS
                                  </span>
                                )}
                                {currentTier === 'VIEW' && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-300 flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-blue-600" />
                                    VIEW ONLY
                                  </span>
                                )}
                                {currentTier === 'DENY' && (
                                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded border border-rose-300 flex items-center gap-1">
                                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                                    DENIED (HIDDEN)
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{mod.description || mod.routePath}</p>
                            </div>

                            {/* Exactly 3 Options Segmented Controls */}
                            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0 shadow-xs">
                              {/* 1. VIEW */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'VIEW',
                                  }))
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                  currentTier === 'VIEW'
                                    ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-600'
                                    : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
                                }`}
                                title="View Only: User can view this page, but cannot edit or make changes"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>

                              {/* 2. FULL ACCESS */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'FULL_ACCESS',
                                  }))
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                  currentTier === 'FULL_ACCESS'
                                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-600'
                                    : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                                }`}
                                title="Full Access: User can view, create, edit, delete and perform all actions"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Full Access
                              </button>

                              {/* 3. DENY */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOverrideState((prev) => ({
                                    ...prev,
                                    [mod.moduleKey]: 'DENY',
                                  }))
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                  currentTier === 'DENY'
                                    ? 'bg-rose-600 text-white shadow-sm ring-1 ring-rose-600'
                                    : 'text-slate-600 hover:text-rose-700 hover:bg-rose-50'
                                }`}
                                title="Deny: Module will not be visible to this user in the sidebar"
                              >
                                <ShieldAlert className="w-3.5 h-3.5" />
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
              Permissions apply immediately upon saving.
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
