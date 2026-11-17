import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  emailPreferencesApi,
  type RoleMatrixResponseDto,
  type EmailPrefsMode,
  type EmailSettingAuditEntryDto,
  type SweepConfigDto,
  type SweepPreviewResponseDto,
} from '../../services/emailPreferencesApi';
import { consumablesApi } from '../../services/consumables.service';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Modal } from '../ui/Modal';
import {
  Check,
  Minus,
  AlertTriangle,
  History,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  Table as TableIcon,
  Clock,
  Eye,
  Loader2,
} from 'lucide-react';

interface RoleRulesPanelProps {
  isReadOnly?: boolean;
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

const ROLE_DISPLAY_ORDER = [
  'DESIGNER',
  'STORES',
  'PRODUCTION',
  'SENIOR_MANAGER',
  'GENERAL_MANAGER',
  'ADMIN',
];

const SWEEP_ORDER = [
  'MATERIAL_ISSUE_OVERDUE_24H',
  'DC_PENDING_2_DAYS',
  'CONSUMABLE_PENDING_2_DAYS',
  'DC_QC_PENDING_24H',
];

const SWEEP_DESCRIPTIONS: Record<string, string> = {
  MATERIAL_ISSUE_OVERDUE_24H:
    'Approved raw material requisition not issued to production within threshold.',
  DC_PENDING_2_DAYS:
    'Delivery Challan dispatched to vendor and not fully returned within threshold (measured from DC creation).',
  CONSUMABLE_PENDING_2_DAYS:
    'Consumable request created and pending fulfillment at any stage within threshold.',
  DC_QC_PENDING_24H:
    'Delivery Challan items inwarded and remaining in quality inspection (QC) within threshold.',
};

export function RoleRulesPanel({ isReadOnly = false }: RoleRulesPanelProps) {
  const [activeView, setActiveView] = useState<'role' | 'overview'>('role');
  const [data, setData] = useState<RoleMatrixResponseDto | null>(null);
  const [stagedMatrix, setStagedMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Alert Sweeps state
  const [sweeps, setSweeps] = useState<SweepConfigDto[]>([]);
  const [stagedSweeps, setStagedSweeps] = useState<
    Record<string, { enabled: boolean; thresholdHours: number }>
  >({});
  const [savingSweeps, setSavingSweeps] = useState<boolean>(false);
  const [saveSweepsConfirmOpen, setSaveSweepsConfirmOpen] = useState<boolean>(false);
  const [consumableMasterEmailEnabled, setConsumableMasterEmailEnabled] = useState<boolean>(true);

  // Preview modal state
  const [previewState, setPreviewState] = useState<{
    isOpen: boolean;
    eventCode: string;
    sweepLabel: string;
    loading: boolean;
    data: SweepPreviewResponseDto | null;
  }>({
    isOpen: false,
    eventCode: '',
    sweepLabel: '',
    loading: false,
    data: null,
  });

  // Mode state
  const [currentMode, setCurrentMode] = useState<EmailPrefsMode>('OFF');
  const [modeConfirmOpen, setModeConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<EmailPrefsMode | null>(null);

  // Save changes dialog
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  // Audit history state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<EmailSettingAuditEntryDto[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Fetch initial matrix and sweep configs
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [res, sweepsRes, consumableSettings] = await Promise.all([
        emailPreferencesApi.getRoleMatrix(),
        emailPreferencesApi.getSweeps().catch(() => [] as SweepConfigDto[]),
        consumablesApi.getAlertSettings().catch(() => ({ consumableEmailAlertsEnabled: true })),
      ]);
      setData(res);
      setCurrentMode(res.mode);
      setSweeps(sweepsRes);

      const initialStagedSweeps: Record<string, { enabled: boolean; thresholdHours: number }> = {};
      for (const s of sweepsRes) {
        initialStagedSweeps[s.eventCode] = {
          enabled: s.enabled,
          thresholdHours: s.thresholdHours,
        };
      }
      setStagedSweeps(initialStagedSweeps);
      setConsumableMasterEmailEnabled(consumableSettings?.consumableEmailAlertsEnabled ?? true);

      // Deep clone matrix for staging
      const clone: Record<string, Record<string, boolean>> = {};
      for (const [rId, eventsMap] of Object.entries(res.matrix as Record<string, Record<string, boolean>>)) {
        clone[rId] = { ...(eventsMap as Record<string, boolean>) };
      }
      setStagedMatrix(clone);

      // Default select first role if not set
      if (!selectedRoleId && res.roles.length > 0) {
        // Prefer STORES or DESIGNER, or first role
        const preferred = res.roles.find(
          (r: any) => r.name === 'STORES' || r.name === 'DESIGNER',
        ) || res.roles[0];
        setSelectedRoleId(preferred.id);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load email role rules matrix');
    } finally {
      setLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, []);

  // Fetch audit history when selected role changes or history is opened
  const loadAuditHistory = useCallback(async (roleId: string) => {
    if (!roleId) return;
    try {
      setLoadingAudit(true);
      const res = await emailPreferencesApi.getAuditLogs({
        scope: 'ROLE',
        targetId: roleId,
        limit: 20,
      });
      setAuditLogs(res.entries || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load audit history for this role');
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  useEffect(() => {
    if (isHistoryOpen && selectedRoleId) {
      loadAuditHistory(selectedRoleId);
    }
  }, [selectedRoleId, isHistoryOpen, loadAuditHistory]);

  // Sorted roles
  const sortedRoles = useMemo(() => {
    if (!data?.roles) return [];
    return [...data.roles].sort((a, b) => {
      const idxA = ROLE_DISPLAY_ORDER.indexOf(a.name);
      const idxB = ROLE_DISPLAY_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  const selectedRole = useMemo(
    () => sortedRoles.find((r) => r.id === selectedRoleId),
    [sortedRoles, selectedRoleId],
  );

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

  // Compute unsaved changes for currently selected role
  const unsavedChanges = useMemo(() => {
    if (!data || !selectedRoleId || !stagedMatrix[selectedRoleId]) return [];
    const orig = data.matrix[selectedRoleId] || {};
    const staged = stagedMatrix[selectedRoleId] || {};
    const changes: Array<{
      eventCode: string;
      label: string;
      oldVal: boolean;
      newVal: boolean;
    }> = [];

    for (const ev of data.events) {
      const oldVal = orig[ev.code] ?? false;
      const newVal = staged[ev.code] ?? false;
      if (oldVal !== newVal) {
        changes.push({
          eventCode: ev.code,
          label: ev.label,
          oldVal,
          newVal,
        });
      }
    }
    return changes;
  }, [data, selectedRoleId, stagedMatrix]);

  // Handle toggle in "By Role" view
  const handleToggle = (eventCode: string) => {
    if (isReadOnly || !selectedRoleId) return;
    setStagedMatrix((prev) => {
      const currentRoleStaged = { ...(prev[selectedRoleId] || {}) };
      const currentVal = currentRoleStaged[eventCode] ?? false;
      currentRoleStaged[eventCode] = !currentVal;
      return {
        ...prev,
        [selectedRoleId]: currentRoleStaged,
      };
    });
  };

  // Discard staged changes for selected role
  const handleDiscardChanges = () => {
    if (!data || !selectedRoleId) return;
    setStagedMatrix((prev) => ({
      ...prev,
      [selectedRoleId]: { ...(data.matrix[selectedRoleId] || {}) },
    }));
    toast.success(`Discarded unsaved changes for ${selectedRole?.name || 'role'}`);
  };

  // Save changes confirmation
  const handleConfirmSave = async () => {
    if (!selectedRoleId || unsavedChanges.length === 0) return;
    try {
      setSaving(true);
      const payload = unsavedChanges.map((c) => ({
        eventCode: c.eventCode,
        enabled: c.newVal,
      }));

      const res = await emailPreferencesApi.bulkUpdateRoleEvents(selectedRoleId, payload);
      toast.success(
        `Updated ${res.updatedCount} notification rule(s) for ${selectedRole?.name || 'role'}`,
      );

      // Update data matrix with new values
      setData((prev) => {
        if (!prev) return prev;
        const newMatrix = { ...prev.matrix };
        const updatedRoleMatrix = { ...(newMatrix[selectedRoleId] || {}) };
        for (const c of unsavedChanges) {
          updatedRoleMatrix[c.eventCode] = c.newVal;
        }
        newMatrix[selectedRoleId] = updatedRoleMatrix;
        return { ...prev, matrix: newMatrix };
      });

      setSaveConfirmOpen(false);

      // Refresh audit logs
      if (isHistoryOpen) {
        loadAuditHistory(selectedRoleId);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save role notification rules');
    } finally {
      setSaving(false);
    }
  };

  // Mode switch handlers
  const handleModeSelect = (newMode: EmailPrefsMode) => {
    if (isReadOnly || newMode === currentMode) return;
    if (newMode === 'ON') {
      setPendingMode('ON');
      setModeConfirmOpen(true);
    } else {
      applyModeChange(newMode);
    }
  };

  const applyModeChange = async (mode: EmailPrefsMode) => {
    try {
      const res = await emailPreferencesApi.updateMode(mode);
      setCurrentMode(res.mode);
      setData((prev) => (prev ? { ...prev, mode: res.mode } : prev));
      toast.success(`Workflow email rules mode switched to ${res.mode}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change email preferences mode');
    } finally {
      setModeConfirmOpen(false);
      setPendingMode(null);
    }
  };

  // Sorted sweeps according to preferred order
  const sortedSweeps = useMemo(() => {
    return [...sweeps].sort((a, b) => {
      const idxA = SWEEP_ORDER.indexOf(a.eventCode);
      const idxB = SWEEP_ORDER.indexOf(b.eventCode);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.eventCode.localeCompare(b.eventCode);
    });
  }, [sweeps]);

  const sweepEnabledMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const s of sweeps) {
      map[s.eventCode] = s.enabled;
    }
    return map;
  }, [sweeps]);

  const unsavedSweepChanges = useMemo(() => {
    return sweeps.filter((s) => {
      const staged = stagedSweeps[s.eventCode];
      if (!staged) return false;
      return staged.enabled !== s.enabled || staged.thresholdHours !== s.thresholdHours;
    });
  }, [sweeps, stagedSweeps]);

  const handleSweepToggle = (eventCode: string) => {
    if (isReadOnly) return;
    setStagedSweeps((prev) => {
      const current = prev[eventCode] || { enabled: false, thresholdHours: 24 };
      return {
        ...prev,
        [eventCode]: { ...current, enabled: !current.enabled },
      };
    });
  };

  const handleSweepThresholdChange = (eventCode: string, hours: number) => {
    if (isReadOnly) return;
    const val = isNaN(hours) ? 1 : Math.max(1, Math.min(720, hours));
    setStagedSweeps((prev) => {
      const current = prev[eventCode] || { enabled: false, thresholdHours: 24 };
      return {
        ...prev,
        [eventCode]: { ...current, thresholdHours: val },
      };
    });
  };

  const handleResetSweeps = () => {
    const reset: Record<string, { enabled: boolean; thresholdHours: number }> = {};
    for (const s of sweeps) {
      reset[s.eventCode] = { enabled: s.enabled, thresholdHours: s.thresholdHours };
    }
    setStagedSweeps(reset);
    toast.success('Reset alert switch changes');
  };

  const handleSaveSweeps = async () => {
    if (unsavedSweepChanges.length === 0) return;
    try {
      setSavingSweeps(true);
      for (const s of unsavedSweepChanges) {
        const staged = stagedSweeps[s.eventCode];
        if (staged) {
          await emailPreferencesApi.updateSweep(s.eventCode, {
            enabled: staged.enabled,
            thresholdHours: staged.thresholdHours,
          });
        }
      }
      const freshSweeps = await emailPreferencesApi.getSweeps();
      setSweeps(freshSweeps);
      const freshStaged: Record<string, { enabled: boolean; thresholdHours: number }> = {};
      for (const s of freshSweeps) {
        freshStaged[s.eventCode] = { enabled: s.enabled, thresholdHours: s.thresholdHours };
      }
      setStagedSweeps(freshStaged);
      setSaveSweepsConfirmOpen(false);
      toast.success('Alert switch settings saved successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save alert switch settings');
    } finally {
      setSavingSweeps(false);
    }
  };

  const handleOpenPreview = async (eventCode: string, label: string) => {
    try {
      setPreviewState({
        isOpen: true,
        eventCode,
        sweepLabel: label,
        loading: true,
        data: null,
      });
      const res = await emailPreferencesApi.previewSweep(eventCode);
      setPreviewState((prev) => ({
        ...prev,
        loading: false,
        data: res,
      }));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load preview');
      setPreviewState((prev) => ({ ...prev, loading: false }));
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

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500 font-medium">Loading email notification rules...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* 1. System Mode Banner & Selector */}
      <div
        className={`rounded-2xl border p-4 transition-all shadow-xs ${
          currentMode === 'ON'
            ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : currentMode === 'SHADOW'
            ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            : 'bg-slate-50/90 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2.5 rounded-xl shrink-0 ${
                currentMode === 'ON'
                  ? 'bg-emerald-500 text-white'
                  : currentMode === 'SHADOW'
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-500 text-white'
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-wide">
                  SYSTEM DISPATCH MODE: {currentMode}
                </span>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentMode === 'ON'
                      ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100'
                      : currentMode === 'SHADOW'
                      ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100'
                      : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {currentMode === 'ON'
                    ? 'Active Rules'
                    : currentMode === 'SHADOW'
                    ? 'Shadow Audit'
                    : 'Legacy Dispatch'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {currentMode === 'OFF' &&
                  'Settings are saved but NOT applied to recipients. Workflow emails still follow legacy hardcoded roles.'}
                {currentMode === 'SHADOW' &&
                  'Old rules still decide who gets email. New rules are evaluated in logs for comparison.'}
                {currentMode === 'ON' &&
                  'These settings actively control who receives workflow emails across all business modules.'}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons (Only editable by ADMIN) */}
          <div className="flex items-center gap-1.5 self-end sm:self-center bg-white/80 dark:bg-[#0e111f] p-1 rounded-xl border border-slate-200 dark:border-[#1e233d] shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2">
              Mode:
            </span>
            {(['OFF', 'SHADOW', 'ON'] as EmailPrefsMode[]).map((m) => (
              <button
                key={m}
                type="button"
                disabled={isReadOnly}
                onClick={() => handleModeSelect(m)}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  currentMode === m
                    ? m === 'ON'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : m === 'SHADOW'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                title={isReadOnly ? 'Read-only view (Admin only)' : `Switch mode to ${m}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Overdue Alert Sweeps Configuration Section */}
      <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-[#1e233d] pb-3.5">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Overdue Alert Sweeps & Thresholds
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Hourly Background Sweeps
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Hourly background jobs check these overdue conditions and dispatch notifications to roles configured below.
            </p>
          </div>

          {unsavedSweepChanges.length > 0 && !isReadOnly && (
            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={handleResetSweeps}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                disabled={savingSweeps}
                onClick={() => setSaveSweepsConfirmOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                Save Alert Switches ({unsavedSweepChanges.length})
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedSweeps.map((sweep) => {
            const staged = stagedSweeps[sweep.eventCode] || {
              enabled: sweep.enabled,
              thresholdHours: sweep.thresholdHours,
            };
            const isDirty =
              staged.enabled !== sweep.enabled ||
              staged.thresholdHours !== sweep.thresholdHours;

            return (
              <div
                key={sweep.eventCode}
                className={`p-4 rounded-xl border transition-all ${
                  isDirty
                    ? 'border-amber-300 dark:border-amber-700 bg-amber-50/20 dark:bg-amber-950/10'
                    : 'border-slate-200 dark:border-[#1e233d] bg-slate-50/50 dark:bg-[#0e111f]/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {sweep.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                        {sweep.eventCode}
                      </span>
                      {isDirty && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                          Modified
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      {SWEEP_DESCRIPTIONS[sweep.eventCode] || 'Background overdue condition monitor.'}
                    </p>
                  </div>

                  {/* Toggle */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[11px] font-bold ${
                        staged.enabled
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {staged.enabled ? 'ON' : 'OFF'}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={staged.enabled}
                      disabled={isReadOnly}
                      onClick={() => handleSweepToggle(sweep.eventCode)}
                      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isReadOnly ? 'cursor-not-allowed opacity-60' : ''
                      } ${staged.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                      title={
                        isReadOnly
                          ? 'Read-only'
                          : `Toggle ${sweep.label} (${staged.enabled ? 'Disable' : 'Enable'})`
                      }
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          staged.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Threshold Hours & Preview Button */}
                <div className="mt-3 pt-3 border-t border-slate-200/70 dark:border-[#1e233d] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Threshold:
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={720}
                        disabled={isReadOnly}
                        value={staged.thresholdHours}
                        onChange={(e) =>
                          handleSweepThresholdChange(sweep.eventCode, parseInt(e.target.value, 10))
                        }
                        className="w-16 px-2 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-none text-center"
                      />
                      <span className="text-xs text-slate-500">hours</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenPreview(sweep.eventCode, sweep.label)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Preview
                  </button>
                </div>

                {/* Warning hint for consumable */}
                {sweep.eventCode === 'CONSUMABLE_PENDING_2_DAYS' && !consumableMasterEmailEnabled && (
                  <div className="mt-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Consumable master email alert is disabled. Even if this switch is ON,
                      no consumable emails will be sent until enabled in System Configuration.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. View Switcher & Subheader */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-[#1e233d] pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Configurable Email Notification Rules
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure which user roles receive automatic workflow email alerts per business event.
          </p>
        </div>

        {/* View Toggle (By Role vs Overview Grid) */}
        <div className="flex items-center bg-slate-100 dark:bg-[#121526] p-1 rounded-xl border border-slate-200 dark:border-[#1e233d]">
          <button
            type="button"
            onClick={() => setActiveView('role')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'role'
                ? 'bg-white dark:bg-[#1e233d] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            By Role
          </button>
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeView === 'overview'
                ? 'bg-white dark:bg-[#1e233d] text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Overview Matrix
          </button>
        </div>
      </div>

      {/* 3. View A: By Role */}
      {activeView === 'role' && (
        <div className="space-y-6">
          {/* Role Selection Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {sortedRoles.map((role) => {
              const isSelected = role.id === selectedRoleId;
              // Check if role has unsaved changes
              const orig = data?.matrix[role.id] || {};
              const staged = stagedMatrix[role.id] || {};
              const hasUnsaved = (data?.events || []).some(
                (ev) => (orig[ev.code] ?? false) !== (staged[ev.code] ?? false),
              );

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRoleId(role.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white dark:bg-[#121526] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1e233d] hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{role.name}</span>
                  {hasUnsaved && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Staged Unsaved Changes Sticky Notification Bar */}
          {unsavedChanges.length > 0 && (
            <div className="sticky top-2 z-20 flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl shadow-md animate-in fade-in">
              <div className="flex items-center gap-2 text-xs text-amber-900 dark:text-amber-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  You have <strong className="font-bold">{unsavedChanges.length}</strong> unsaved
                  change{unsavedChanges.length > 1 ? 's' : ''} for{' '}
                  <strong className="font-bold">{selectedRole?.name}</strong>.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => setSaveConfirmOpen(true)}
                  disabled={saving}
                  className="flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </div>
          )}

          {/* Events Categories List for Selected Role */}
          <div className="space-y-6">
            {sortedCategories.map(([category, events]) => (
              <div
                key={category}
                className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] overflow-hidden shadow-xs"
              >
                <div className="px-5 py-3.5 bg-slate-50/70 dark:bg-[#0e111f] border-b border-slate-200 dark:border-[#1e233d] flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {CATEGORY_TITLES[category] || category}
                  </span>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">
                    {events.length} event{events.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                  {events.map((ev) => {
                    const isEnabled = stagedMatrix[selectedRoleId]?.[ev.code] ?? false;
                    const isSweepOff = sweepEnabledMap[ev.code] === false;
                    const origVal = data?.matrix[selectedRoleId]?.[ev.code] ?? false;
                    const isStagedDirty = isEnabled !== origVal;

                    return (
                      <div
                        key={ev.code}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isStagedDirty
                            ? 'bg-amber-50/30 dark:bg-amber-950/10'
                            : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                        }`}
                      >
                        <div className="space-y-1 pr-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {ev.label}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {ev.code}
                            </span>
                            {isSweepOff && (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                title="Background sweep for this alert is currently turned off"
                              >
                                Alert switch is OFF
                              </span>
                            )}
                            {isStagedDirty && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                                Unsaved: {isEnabled ? 'ON' : 'OFF'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Dispatches email alert to active users with role{' '}
                            <strong className="text-slate-700 dark:text-slate-300">
                              {selectedRole?.name}
                            </strong>{' '}
                            when this event triggers.
                          </p>
                        </div>

                        {/* Toggle Button */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <span
                            className={`text-xs font-bold ${
                              isEnabled
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {isEnabled ? 'ENABLED' : 'DISABLED'}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isEnabled}
                            disabled={isReadOnly}
                            onClick={() => handleToggle(ev.code)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                              isReadOnly ? 'cursor-not-allowed opacity-60' : ''
                            } ${isEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                            title={
                              isReadOnly
                                ? 'Read-only access'
                                : `Toggle ${ev.label} for ${selectedRole?.name}`
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                isEnabled ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Collapsible Change History for Selected Role */}
          <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className="w-full px-5 py-3.5 bg-slate-50/70 dark:bg-[#0e111f] flex items-center justify-between text-left hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Audit History: {selectedRole?.name} (Last 20 Changes)
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
                  <p className="text-xs text-slate-400 text-center py-4">Loading audit entries...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    No change records found for {selectedRole?.name}.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-[#1e233d] text-xs">
                      <thead>
                        <tr className="text-slate-500 dark:text-slate-400 text-left font-semibold">
                          <th className="py-2 pr-4">Timestamp</th>
                          <th className="py-2 px-4">Event Code</th>
                          <th className="py-2 px-4">Change</th>
                          <th className="py-2 pl-4">Changed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                        {auditLogs.map((log) => (
                          <tr key={log.id} className="text-slate-700 dark:text-slate-300">
                            <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">
                              {formatTimestamp(log.changedAt)}
                            </td>
                            <td className="py-2 px-4 font-mono font-medium">{log.eventCode}</td>
                            <td className="py-2 px-4 font-bold">
                              <span className="text-slate-400">{log.oldValue || 'OFF'}</span>
                              <span className="mx-1 text-slate-400">➔</span>
                              <span
                                className={
                                  log.newValue === 'ON' ? 'text-emerald-600' : 'text-rose-600'
                                }
                              >
                                {log.newValue}
                              </span>
                            </td>
                            <td className="py-2 pl-4">{log.changedByName}</td>
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

      {/* 4. View B: Overview Grid */}
      {activeView === 'overview' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-200">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Overview matrix reflects saved role-based notification settings. To modify rules, switch
              to the <strong>By Role</strong> tab above.
            </span>
          </div>

          <div className="bg-white dark:bg-[#121526] rounded-2xl border border-slate-200 dark:border-[#1e233d] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-[#1e233d] text-xs">
                <thead className="bg-slate-50/80 dark:bg-[#0e111f]">
                  <tr>
                    <th className="py-3 px-4 text-left font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[280px]">
                      Notification Event
                    </th>
                    {sortedRoles.map((role) => (
                      <th
                        key={role.id}
                        className="py-3 px-3 text-center font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider"
                      >
                        {role.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                  {sortedCategories.map(([category, events]) => (
                    <tr key={category} className="contents">
                      <td
                        colSpan={sortedRoles.length + 1}
                        className="py-2 px-4 bg-slate-100/60 dark:bg-[#0e111f]/60 font-bold text-[11px] text-slate-600 dark:text-slate-400 uppercase tracking-wider border-t border-slate-200 dark:border-[#1e233d]"
                      >
                        {CATEGORY_TITLES[category] || category}
                      </td>
                      {events.map((ev) => {
                        const isSweepOff = sweepEnabledMap[ev.code] === false;

                        return (
                          <tr
                            key={ev.code}
                            className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20"
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {ev.label}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                                  ({ev.code})
                                </span>
                                {isSweepOff && (
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    title="Background sweep for this alert is currently turned off"
                                  >
                                    Alert switch is OFF
                                  </span>
                                )}
                              </div>
                            </td>
                            {sortedRoles.map((role) => {
                              const isEnabled = data?.matrix[role.id]?.[ev.code] ?? false;
                              return (
                                <td key={role.id} className="py-2.5 px-3 text-center">
                                  {isEnabled ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border border-emerald-200 dark:border-emerald-800">
                                      <Check className="w-3.5 h-3.5" />
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800/40 text-slate-400">
                                      <Minus className="w-3.5 h-3.5" />
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Save Changes Confirmation Dialog */}
      <ConfirmDialog
        isOpen={saveConfirmOpen}
        onClose={() => setSaveConfirmOpen(false)}
        onConfirm={handleConfirmSave}
        title={`Save Notification Rules for ${selectedRole?.name}`}
        message={
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to save the following{' '}
              <strong>{unsavedChanges.length}</strong> change
              {unsavedChanges.length > 1 ? 's' : ''} for role{' '}
              <strong>{selectedRole?.name}</strong>?
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
                    <span className={c.oldVal ? 'text-emerald-600' : 'text-slate-400'}>
                      {c.oldVal ? 'ON' : 'OFF'}
                    </span>
                    <span className="mx-1 text-slate-400">➔</span>
                    <span className={c.newVal ? 'text-emerald-600' : 'text-rose-600'}>
                      {c.newVal ? 'ON' : 'OFF'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            {currentMode !== 'ON' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 italic">
                Note: Current mode is <strong>{currentMode}</strong>. Changes will be saved, but will
                only actively affect recipients once mode is set to <strong>ON</strong>.
              </p>
            )}
          </div>
        }
        confirmText="Save Rules"
        cancelText="Cancel"
      />

      {/* Mode Switch to ON Confirmation Dialog */}
      <ConfirmDialog
        isOpen={modeConfirmOpen}
        onClose={() => {
          setModeConfirmOpen(false);
          setPendingMode(null);
        }}
        onConfirm={() => {
          if (pendingMode) applyModeChange(pendingMode);
        }}
        title="Activate Live Email Notification Rules (ON)"
        message={
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to switch the email preferences mode to <strong>ON</strong>?
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">Important Operational Impact:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>All outgoing workflow emails will follow these role rules and user overrides.</li>
                <li>Legacy hardcoded recipient lists will no longer take effect.</li>
              </ul>
            </div>
          </div>
        }
        confirmText="Activate (ON)"
        cancelText="Cancel"
      />

      {/* Preview Modal */}
      <Modal
        isOpen={previewState.isOpen}
        onClose={() => setPreviewState((prev) => ({ ...prev, isOpen: false }))}
        title={
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span>Preview: {previewState.sweepLabel}</span>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Event Code: <strong className="font-mono text-slate-700 dark:text-slate-300">{previewState.eventCode}</strong>
            </span>
            <span className="italic">Read-only preview • No emails dispatched</span>
          </div>

          {previewState.loading ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <p className="text-xs text-slate-500 mt-2">Checking matching items...</p>
            </div>
          ) : previewState.data ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 flex items-center justify-between">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  Total Matching Items:
                </span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {previewState.data.matchCount} item{previewState.data.matchCount === 1 ? '' : 's'}
                </span>
              </div>

              {previewState.data.notYetTimedCount !== undefined &&
                previewState.data.notYetTimedCount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    <strong>Note:</strong> {previewState.data.notYetTimedCount} item(s) are currently in QC but have not yet been observed by a background sweep. They will start timing from the next hourly run.
                  </div>
                )}

              {previewState.data.sample && previewState.data.sample.length > 0 ? (
                <div className="border border-slate-200 dark:border-[#1e233d] rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-[#0e111f] text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-[#1e233d]">
                      <tr>
                        <th className="py-2 px-3">Reference #</th>
                        <th className="py-2 px-3">Hours Pending</th>
                        <th className="py-2 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-[#1e233d]">
                      {previewState.data.sample.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-white">
                            {item.referenceNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-300 font-mono">
                            {item.hoursPending}h
                          </td>
                          <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                            {item.details?.vendor && (
                              <div>Vendor: {item.details.vendor}</div>
                            )}
                            {item.details?.requester && (
                              <div>Requester: {item.details.requester}</div>
                            )}
                            {item.details?.itemCount !== undefined && (
                              <div>Items: {item.details.itemCount}</div>
                            )}
                            {item.details?.status && (
                              <div>Status: {item.details.status}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-slate-400 italic">
                  No items currently exceed the configured threshold.
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-[#1e233d]">
            <button
              type="button"
              onClick={() => setPreviewState((prev) => ({ ...prev, isOpen: false }))}
              className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Save Alert Sweeps Confirmation Dialog */}
      <ConfirmDialog
        isOpen={saveSweepsConfirmOpen}
        onClose={() => setSaveSweepsConfirmOpen(false)}
        onConfirm={handleSaveSweeps}
        title="Save Overdue Alert Switch Settings"
        message={
          <div className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to save changes to <strong>{unsavedSweepChanges.length}</strong> alert switch{unsavedSweepChanges.length > 1 ? 'es' : ''}?
            </p>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1.5 bg-slate-50 dark:bg-slate-900 text-xs">
              {unsavedSweepChanges.map((s) => {
                const staged = stagedSweeps[s.eventCode];
                return (
                  <div
                    key={s.eventCode}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</div>
                      <div className="text-[10px] text-slate-400">{s.eventCode}</div>
                    </div>
                    <div className="text-right">
                      <div>
                        Status: <strong className={staged.enabled ? 'text-emerald-600' : 'text-slate-400'}>{staged.enabled ? 'ON' : 'OFF'}</strong>
                        {staged.enabled !== s.enabled && <span className="text-slate-400 ml-1">(was {s.enabled ? 'ON' : 'OFF'})</span>}
                      </div>
                      <div>
                        Threshold: <strong>{staged.thresholdHours}h</strong>
                        {staged.thresholdHours !== s.thresholdHours && <span className="text-slate-400 ml-1">(was {s.thresholdHours}h)</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        }
        confirmText="Save Alert Switches"
        cancelText="Cancel"
      />
    </div>
  );
}
