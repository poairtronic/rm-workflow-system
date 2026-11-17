import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import {
  emailPreferencesApi,
  type UserPreferencesResponseDto,
  type UserOverrideState,
  type EmailSettingAuditEntryDto,
  type SweepConfigDto,
} from '../../services/emailPreferencesApi';
import { consumablesApi } from '../../services/consumables.service';
import type { UserMasterDto } from '../../types/user-master.dto';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  X,
  Mail,
  AlertTriangle,
  History,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface UserEmailPreferencesDrawerProps {
  user: UserMasterDto | null;
  isOpen: boolean;
  onClose: () => void;
  isReadOnly?: boolean;
  onSaved?: () => void;
}

const CATEGORY_ORDER = [
  'RAW_MATERIAL',
  'MATERIAL_ISSUE',
  'INVENTORY',
  'DELIVERY_CHALLAN',
  'CONSUMABLE',
];

const CATEGORY_TITLES: Record<string, string> = {
  RAW_MATERIAL: 'Raw Material Requisitions',
  MATERIAL_ISSUE: 'Material Issues & Approvals',
  INVENTORY: 'Inventory & Stock Alerts',
  DELIVERY_CHALLAN: 'Delivery Challan & Inward',
  CONSUMABLE: 'Consumables & PO Requests',
};

export function UserEmailPreferencesDrawer({
  user,
  isOpen,
  onClose,
  isReadOnly = false,
  onSaved,
}: UserEmailPreferencesDrawerProps) {
  const [data, setData] = useState<UserPreferencesResponseDto | null>(null);
  const [stagedOverrides, setStagedOverrides] = useState<Record<string, UserOverrideState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Save confirm modal
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  // Audit history
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<EmailSettingAuditEntryDto[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [sweepsMap, setSweepsMap] = useState<Record<string, boolean>>({});
  const [consumableMasterEnabled, setConsumableMasterEnabled] = useState(true);

  // Fetch preferences for user
  const loadUserPreferences = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      const [res, sweeps, consumableSettings] = await Promise.all([
        emailPreferencesApi.getUserPreferences(userId),
        emailPreferencesApi.getSweeps().catch(() => [] as SweepConfigDto[]),
        consumablesApi.getAlertSettings().catch(() => ({ consumableEmailAlertsEnabled: true })),
      ]);
      setData(res);

      const sMap: Record<string, boolean> = {};
      for (const s of sweeps) {
        sMap[s.eventCode] = s.enabled;
      }
      setSweepsMap(sMap);
      setConsumableMasterEnabled(consumableSettings?.consumableEmailAlertsEnabled ?? true);

      const initialOverrides: Record<string, UserOverrideState> = {};
      for (const ev of res.events) {
        initialOverrides[ev.code] = ev.override;
      }
      setStagedOverrides(initialOverrides);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load user email preferences';
      setLoadError(msg);
      // Prevent duplicate toast for the same user load error
      toast.error(msg, { id: `load-pref-err-${userId}` });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAuditHistory = useCallback(async (userId: string) => {
    try {
      setLoadingAudit(true);
      const res = await emailPreferencesApi.getAuditLogs({
        scope: 'USER',
        targetId: userId,
        limit: 20,
      });
      setAuditLogs(res.entries || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load audit history for user');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadUserPreferences(user.id);
    } else {
      setData(null);
      setStagedOverrides({});
      setLoadError(null);
      setJustSaved(false);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setIsHistoryOpen(false);
      setAuditLogs([]);
    }
  }, [isOpen, user?.id, loadUserPreferences]);

  useEffect(() => {
    if (isOpen && isHistoryOpen && user?.id) {
      loadAuditHistory(user.id);
    }
  }, [isOpen, isHistoryOpen, user?.id, loadAuditHistory]);

  // Group events by category
  const groupedEvents = useMemo(() => {
    if (!data?.events) return {};
    const groups: Record<string, typeof data.events> = {};
    for (const ev of data.events) {
      const cat = ev.category || 'OTHER';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(ev);
    }
    return groups;
  }, [data]);

  // Order category groups consistently: Raw Material, Material Issue, Inventory, Delivery Challan, Consumables
  const sortedCategories = useMemo(() => {
    return Object.entries(groupedEvents).sort(([catA], [catB]) => {
      const idxA = CATEGORY_ORDER.indexOf(catA);
      const idxB = CATEGORY_ORDER.indexOf(catB);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return catA.localeCompare(catB);
    });
  }, [groupedEvents]);

  // Calculate unsaved changes
  const unsavedChanges = useMemo(() => {
    if (!data?.events) return [];
    const changes: Array<{
      eventCode: string;
      label: string;
      oldState: UserOverrideState;
      newState: UserOverrideState;
    }> = [];

    for (const ev of data.events) {
      const oldState = ev.override;
      const newState = stagedOverrides[ev.code] || 'INHERIT';
      if (oldState !== newState) {
        changes.push({
          eventCode: ev.code,
          label: ev.label,
          oldState,
          newState,
        });
      }
    }
    return changes;
  }, [data, stagedOverrides]);

  // Handle setting override for an event
  const handleSetOverride = (eventCode: string, state: UserOverrideState) => {
    if (isReadOnly || !user?.isActive) return;
    setJustSaved(false);
    setStagedOverrides((prev) => ({
      ...prev,
      [eventCode]: state,
    }));
  };

  // Reset all to INHERIT
  const handleResetAllToInherit = () => {
    if (isReadOnly || !user?.isActive || !data?.events) return;
    setJustSaved(false);
    const resetMap: Record<string, UserOverrideState> = {};
    for (const ev of data.events) {
      resetMap[ev.code] = 'INHERIT';
    }
    setStagedOverrides(resetMap);
    toast.success('Reset all notification events to Inherit');
  };

  // Discard changes back to original
  const handleDiscard = () => {
    if (!data?.events) return;
    setJustSaved(false);
    const initialMap: Record<string, UserOverrideState> = {};
    for (const ev of data.events) {
      initialMap[ev.code] = ev.override;
    }
    setStagedOverrides(initialMap);
    toast.success('Discarded unsaved override changes');
  };

  // Confirm and Save
  const handleConfirmSave = async () => {
    if (!user?.id || unsavedChanges.length === 0) return;
    try {
      setSaving(true);
      const payload = unsavedChanges.map((c) => ({
        eventCode: c.eventCode,
        state: c.newState,
      }));

      const res = await emailPreferencesApi.bulkUpdateUserOverrides(user.id, payload);
      toast.success(`Updated ${res.updatedCount} preference override(s) for ${user.name}`);

      // Re-load data to ensure source & effective are fully re-evaluated
      await loadUserPreferences(user.id);
      setSaveConfirmOpen(false);
      setJustSaved(true);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setJustSaved(false);
      }, 4000);
      onSaved?.();

      if (isHistoryOpen) {
        loadAuditHistory(user.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save user email overrides');
    } finally {
      setSaving(false);
    }
  };

  const formatTimestamp = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).toLowerCase()
      );
    } catch {
      return dateStr;
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-2xl bg-white dark:bg-[#121526] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#1e233d]">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-[#1e233d] bg-slate-50/70 dark:bg-[#0e111f] shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="p-1.5 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    User Email Preferences
                  </h2>
                  {data?.mode && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        data.mode === 'ON'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : data.mode === 'SHADOW'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      Mode: {data.mode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                  <span className="font-semibold text-slate-900 dark:text-slate-200">
                    {user.name}
                  </span>
                  <span>({user.email})</span>
                  <span className="text-[11px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-1.5 py-0.5 rounded">
                    Role: {user.role?.name || 'USER'}
                  </span>
                  {user.department && (
                    <span className="text-[11px] text-slate-500">• {user.department}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inactive user warning */}
            {!user.isActive && (
              <div className="mt-3 p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  <strong>Account Inactive:</strong> Inactive users cannot receive workflow email
                  dispatches regardless of role or override settings.
                </span>
              </div>
            )}

            {/* Legacy Email Off Warning */}
            {data?.legacyEmailOff && (
              <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Legacy Email Disabled:</span> This user previously
                  turned off workflow emails in old notification settings. When mode is ON,
                  role rules and user overrides will take precedence.
                </div>
              </div>
            )}
          </div>

          {/* Quick Toolbar: Instructions & Reset All (only when data successfully loaded) */}
          {data && !loadError && (
            <div className="px-5 py-2.5 bg-slate-100/70 dark:bg-[#0e111f]/60 border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between text-xs shrink-0">
              <span className="text-slate-600 dark:text-slate-400">
                Each event can <strong>Inherit</strong> from role or be explicitly set to{' '}
                <strong>On</strong> or <strong>Off</strong>.
              </span>
              <button
                type="button"
                disabled={isReadOnly || !user.isActive}
                onClick={handleResetAllToInherit}
                className={`flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ${
                  isReadOnly || !user.isActive ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                title="Reset all events to Inherit"
              >
                <RotateCcw className="w-3 h-3" />
                Reset All to Inherit
              </button>
            </div>
          )}

          {/* Drawer Body - Scrollable Event List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12">
                <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="mt-2 text-xs text-slate-500">Loading user preferences...</p>
              </div>
            ) : loadError || !data ? (
              <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-full text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Failed to load preferences
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                    {loadError || 'An error occurred while fetching user email preferences.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => user?.id && loadUserPreferences(user.id)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedCategories.map(([category, events]) => (
                  <div
                    key={category}
                    className="bg-white dark:bg-[#121526] rounded-xl border border-slate-200 dark:border-[#1e233d] overflow-hidden shadow-2xs"
                  >
                    <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-[#0e111f] border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        {CATEGORY_TITLES[category] || category}
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {events.length} event{events.length > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                      {events.map((ev) => {
                        const stagedState = stagedOverrides[ev.code] || 'INHERIT';
                        const isSweepOff = sweepsMap[ev.code] === false;
                        const isStagedDirty = stagedState !== ev.override;

                        // Calculate effective state representation
                        const isEffectiveOn =
                          stagedState === 'ON'
                            ? true
                            : stagedState === 'OFF'
                            ? false
                            : ev.roleEnabled;

                        return (
                          <div
                            key={ev.code}
                            className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                              isStagedDirty
                                ? 'bg-amber-50/30 dark:bg-amber-950/10'
                                : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/10'
                            }`}
                          >
                            <div className="space-y-1 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-semibold text-slate-900 dark:text-white">
                                  {ev.label}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                  {ev.code}
                                </span>
                                {isSweepOff && (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    title="Background sweep for this alert is currently disabled"
                                  >
                                    Alert switch is OFF
                                  </span>
                                )}
                                {isStagedDirty && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                    Changed
                                  </span>
                                )}
                              </div>

                              {ev.code === 'CONSUMABLE_PENDING_2_DAYS' && !consumableMasterEnabled && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                  Note: Consumable master email alert is disabled in System Configuration.
                                </p>
                              )}

                              {/* Effective Status Result Line */}
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isEffectiveOn ? 'bg-emerald-500' : 'bg-slate-400'
                                  }`}
                                />
                                <span>
                                  {stagedState === 'INHERIT' && (
                                    <>
                                      Inherit ➔{' '}
                                      <strong
                                        className={
                                          ev.roleEnabled
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-slate-600 dark:text-slate-400'
                                        }
                                      >
                                        {ev.roleEnabled ? 'ON' : 'OFF'}
                                      </strong>{' '}
                                      (from {user.role?.name || 'role'} role)
                                    </>
                                  )}
                                  {stagedState === 'ON' && (
                                    <strong className="text-emerald-600 dark:text-emerald-400">
                                      ON (set specifically for this user)
                                    </strong>
                                  )}
                                  {stagedState === 'OFF' && (
                                    <strong className="text-rose-600 dark:text-rose-400">
                                      OFF (suppressed for this user)
                                    </strong>
                                  )}
                                </span>
                              </div>
                            </div>

                            {/* 3-State Segmented Control: [ Inherit | On | Off ] */}
                            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-100 dark:bg-slate-800 shrink-0 self-end sm:self-center">
                              {(['INHERIT', 'ON', 'OFF'] as UserOverrideState[]).map((state) => {
                                const isSelected = stagedState === state;
                                return (
                                  <button
                                    key={state}
                                    type="button"
                                    disabled={isReadOnly || !user.isActive}
                                    onClick={() => handleSetOverride(ev.code, state)}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                                      isSelected
                                        ? state === 'ON'
                                          ? 'bg-emerald-600 text-white shadow-xs'
                                          : state === 'OFF'
                                          ? 'bg-rose-600 text-white shadow-xs'
                                          : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                    } ${isReadOnly || !user.isActive ? 'cursor-not-allowed opacity-60' : ''}`}
                                  >
                                    {state === 'INHERIT'
                                      ? 'Inherit'
                                      : state === 'ON'
                                      ? 'On'
                                      : 'Off'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Collapsible Change History */}
                <div className="bg-white dark:bg-[#121526] rounded-xl border border-slate-200 dark:border-[#1e233d] overflow-hidden shadow-xs">
                  <button
                    type="button"
                    onClick={() => setIsHistoryOpen((prev) => !prev)}
                    className="w-full px-4 py-3 bg-slate-50/70 dark:bg-[#0e111f] flex items-center justify-between text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        User Audit History (Last 20 Changes)
                      </span>
                    </div>
                    {isHistoryOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {isHistoryOpen && (
                    <div className="p-4 border-t border-slate-200 dark:border-[#1e233d]">
                      {loadingAudit ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                          Loading audit records...
                        </p>
                      ) : auditLogs.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-3">
                          No audit records found for this user.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-100 dark:divide-[#1e233d] text-xs">
                            <thead>
                              <tr className="text-slate-500 text-left font-semibold">
                                <th className="py-2 pr-3">Timestamp</th>
                                <th className="py-2 px-3">Event Code</th>
                                <th className="py-2 px-3">State Change</th>
                                <th className="py-2 pl-3">Updated By</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                              {auditLogs.map((log) => (
                                <tr key={log.id} className="text-slate-700 dark:text-slate-300">
                                  <td className="py-2 pr-3 text-slate-500">
                                    {formatTimestamp(log.changedAt)}
                                  </td>
                                  <td className="py-2 px-3 font-mono font-medium">{log.eventCode}</td>
                                  <td className="py-2 px-3 font-bold">
                                    <span className="text-slate-400">
                                      {log.oldValue || 'INHERIT'}
                                    </span>
                                    <span className="mx-1 text-slate-400">➔</span>
                                    <span
                                      className={
                                        log.newValue === 'ON'
                                          ? 'text-emerald-600'
                                          : log.newValue === 'OFF'
                                          ? 'text-rose-600'
                                          : 'text-slate-600'
                                      }
                                    >
                                      {log.newValue}
                                    </span>
                                  </td>
                                  <td className="py-2 pl-3">{log.changedByName}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Drawer Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-[#1e233d] bg-slate-50/80 dark:bg-[#0e111f] flex items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-medium">
              {data && !loadError ? (
                unsavedChanges.length > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    {unsavedChanges.length} unsaved change{unsavedChanges.length > 1 ? 's' : ''}
                  </span>
                ) : justSaved ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    All preferences saved
                  </span>
                ) : (
                  <span className="text-slate-500 dark:text-slate-400">
                    No unsaved changes
                  </span>
                )
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
              {data && !loadError && unsavedChanges.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={saving}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaveConfirmOpen(true)}
                    disabled={saving || isReadOnly}
                    className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save Preferences
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog for Saving Overrides */}
      <ConfirmDialog
        isOpen={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={`Save Overrides for ${user.name}`}
        message={
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Apply the following <strong>{unsavedChanges.length}</strong> override change
              {unsavedChanges.length > 1 ? 's' : ''} for <strong>{user.name}</strong>?
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5 bg-slate-50 dark:bg-slate-900 text-xs">
              {unsavedChanges.map((c) => (
                <div
                  key={c.eventCode}
                  className="flex items-center justify-between p-1.5 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700"
                >
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {c.label}
                  </span>
                  <span className="font-bold">
                    <span className="text-slate-400">{c.oldState}</span>
                    <span className="mx-1 text-slate-400">➔</span>
                    <span
                      className={
                        c.newState === 'ON'
                          ? 'text-emerald-600'
                          : c.newState === 'OFF'
                          ? 'text-rose-600'
                          : 'text-slate-600'
                      }
                    >
                      {c.newState}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        }
        confirmText="Save Overrides"
        cancelText="Cancel"
      />
    </div>
  );
}
