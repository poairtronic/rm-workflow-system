import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { systemSettingsApi } from '../services/api';
import { PageHeader } from '../components/ui';
import { applyTheme, applyDensity } from '../utils/theme';
import {
  Laptop,
  Bell,
  Globe,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Save,
} from 'lucide-react';

export function SystemConfigurationWorkspace() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [theme, setTheme] = useState('Enterprise Light');
  const [density, setDensity] = useState('Compact');

  // Notifications
  const [globalEmail, setGlobalEmail] = useState(true);
  const [workflowAlerts, setWorkflowAlerts] = useState(true);
  const [dcOverdueAlerts, setDcOverdueAlerts] = useState(true);
  const [materialIssueOverdueAlerts, setMaterialIssueOverdueAlerts] = useState(true);
  const [lowStockMslAlerts, setLowStockMslAlerts] = useState(true);
  const [stockMovementAlerts, setStockMovementAlerts] = useState(true);

  // Regional
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [dateFormat, setDateFormat] = useState('DD MMM YYYY');
  const [defaultStockUnit, setDefaultStockUnit] = useState('Meters');

  // Thresholds
  const [dcReturnSlaDays, setDcReturnSlaDays] = useState(7);
  const [materialIssueOverdueHours, setMaterialIssueOverdueHours] = useState(48);
  const [mslCheckIntervalHours, setMslCheckIntervalHours] = useState(24);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const res = await systemSettingsApi.getConfig();
      if (res) {
        if (res.appearance) {
          const localTheme = localStorage.getItem('rm_theme_preference');
          const t = localTheme || res.appearance.theme || 'Modern Dark';
          const localDensity = localStorage.getItem('rm_data_density');
          const d = localDensity || res.appearance.density || 'Compact';
          setTheme(t);
          setDensity(d);
          applyTheme(t);
          applyDensity(d);
        }
        if (res.notifications) {
          setGlobalEmail(res.notifications.globalEmailEnabled ?? true);
          setWorkflowAlerts(res.notifications.workflowAlertsEnabled ?? true);
          setDcOverdueAlerts(res.notifications.dcOverdueAlertsEnabled ?? true);
          setMaterialIssueOverdueAlerts(res.notifications.materialIssueOverdueAlertsEnabled ?? true);
          setLowStockMslAlerts(res.notifications.lowStockMslAlertsEnabled ?? true);
          setStockMovementAlerts(res.notifications.stockMovementAlertsEnabled ?? true);
        }
        if (res.regional) {
          setTimezone(res.regional.timezone || 'Asia/Kolkata (IST)');
          setDateFormat(res.regional.dateFormat || 'DD MMM YYYY');
          setDefaultStockUnit(res.regional.defaultStockUnit || 'Meters');
        }
        if (res.thresholds) {
          setDcReturnSlaDays(res.thresholds.dcReturnSlaDays ?? 7);
          setMaterialIssueOverdueHours(res.thresholds.materialIssueOverdueHours ?? 48);
          setMslCheckIntervalHours(res.thresholds.mslCheckIntervalHours ?? 24);
        }
      }
    } catch {
      toast.error('Failed to load system configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      applyTheme(theme);
      applyDensity(density);
      await systemSettingsApi.updateConfig({
        appearance: { theme, density },
        notifications: {
          globalEmailEnabled: globalEmail,
          workflowAlertsEnabled: workflowAlerts,
          dcOverdueAlertsEnabled: dcOverdueAlerts,
          materialIssueOverdueAlertsEnabled: materialIssueOverdueAlerts,
          lowStockMslAlertsEnabled: lowStockMslAlerts,
          stockMovementAlertsEnabled: stockMovementAlerts,
        },
        regional: {
          timezone,
          dateFormat,
          defaultStockUnit,
        },
        thresholds: {
          dcReturnSlaDays: Number(dcReturnSlaDays),
          materialIssueOverdueHours: Number(materialIssueOverdueHours),
          mslCheckIntervalHours: Number(mslCheckIntervalHours),
        },
      });
      toast.success('System configuration saved successfully!');
    } catch {
      toast.error('Failed to update system configuration.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 w-full pb-16">
      <PageHeader
        title="System Configuration"
        subtitle="Manage enterprise global settings, notifications, and application preferences."
        breadcrumbs={<span>Home / System Settings / Configuration</span>}
        actionSlot={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadConfig}
              disabled={loading || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition shadow-sm cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      />

        {/* Section 1: Appearance & UI */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Appearance &amp; UI</h2>
              <p className="text-xs text-slate-500">Visual layout, contrast, and table density.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Theme Preference
              </label>
              <select
                value={theme}
                onChange={(e) => {
                  const val = e.target.value;
                  setTheme(val);
                  applyTheme(val);
                  toast.success(`Theme switched to ${val}`);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="Enterprise Light">Enterprise Light</option>
                <option value="Modern Dark">Modern Dark</option>
                <option value="Enterprise Slate">Enterprise Slate</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">Select your preferred application visual theme</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Data Density
              </label>
              <select
                value={density}
                onChange={(e) => {
                  const val = e.target.value;
                  setDensity(val);
                  applyDensity(val);
                  toast.success(`Data density set to ${val}`);
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="Compact">Compact (High Information Density)</option>
                <option value="Comfortable">Comfortable (Spaced Layout)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">Adjust the density of tables, forms, and lists</p>
            </div>
          </div>
        </div>

        {/* Section 2: Notifications & Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Notifications &amp; Alerts</h2>
              <p className="text-xs text-slate-500">Automated triggers across DC, RM, Stores, and Stock workflows.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Global Email */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Global Email Notifications</span>
                <span className="text-xs text-slate-500">
                  Enable or disable all email dispatch notifications globally for all users
                </span>
              </div>
              <button
                type="button"
                onClick={() => setGlobalEmail(!globalEmail)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  globalEmail ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    globalEmail ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Workflow Alerts */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Workflow &amp; Requisition Alerts</span>
                <span className="text-xs text-slate-500">
                  Instant in-app alerts when an RM requisition or extra request requires store attention
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWorkflowAlerts(!workflowAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  workflowAlerts ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    workflowAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Delivery Challan Overdue Alerts */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">DC Return Overdue Alerts</span>
                <span className="text-xs text-slate-500">
                  Alert Stores, Senior Manager, and Admin when outbound vendor DCs exceed SLA return window
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDcOverdueAlerts(!dcOverdueAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  dcOverdueAlerts ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    dcOverdueAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Material Issue Overdue Alerts */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Material Issue Overdue Alerts</span>
                <span className="text-xs text-slate-500">
                  Alert Stores and GM when approved RM requests remain unissued for longer than SLA threshold
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMaterialIssueOverdueAlerts(!materialIssueOverdueAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  materialIssueOverdueAlerts ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    materialIssueOverdueAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Low Stock & MSL Alerts */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Minimum Safety Level (MSL) Alerts</span>
                <span className="text-xs text-slate-500">
                  Automated notifications when inventory balance breaches minimum safety stock threshold
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLowStockMslAlerts(!lowStockMslAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  lowStockMslAlerts ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    lowStockMslAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Stock Movement Alerts */}
            <div className="flex items-center justify-between p-4 bg-slate-50/70 border border-slate-100 rounded-xl">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Stock Inward &amp; Movement Alerts</span>
                <span className="text-xs text-slate-500">
                  Broadcast notification on Supplier GRN inward receipts and inter-bin transfers
                </span>
              </div>
              <button
                type="button"
                onClick={() => setStockMovementAlerts(!stockMovementAlerts)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  stockMovementAlerts ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    stockMovementAlerts ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Pill summary badges */}
          <div className="flex flex-wrap items-center gap-3 mt-6 pt-4 border-t border-slate-100">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                globalEmail ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Email (Global): {globalEmail ? 'On' : 'Off'}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                workflowAlerts ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Workflow: {workflowAlerts ? 'On' : 'Off'}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                dcOverdueAlerts ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              DC Alerts: {dcOverdueAlerts ? 'On' : 'Off'}
            </span>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                lowStockMslAlerts ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              MSL Alerts: {lowStockMslAlerts ? 'On' : 'Off'}
            </span>
          </div>
        </div>

        {/* Section 3: Regional & Unit Settings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Regional &amp; System Settings</h2>
              <p className="text-xs text-slate-500">Localization, timezone, and physical inventory units.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="UTC">Universal Coordinated Time (UTC)</option>
                <option value="America/New_York (EST)">America/New_York (EST)</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">System timestamp standard across all logs and audits</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Date Format
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="DD MMM YYYY">DD MMM YYYY (e.g., 13 Oct 2026)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">Date formatting applied to tables, reports, and DCs</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Default Inventory Unit
              </label>
              <select
                value={defaultStockUnit}
                onChange={(e) => setDefaultStockUnit(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Meters">Meters (m)</option>
                <option value="Kilograms">Kilograms (Kg)</option>
                <option value="Rolls">Rolls</option>
                <option value="Pieces">Pieces (Pcs)</option>
                <option value="Sets">Sets</option>
              </select>
              <p className="text-xs text-slate-400 mt-1.5">Primary UOM fallback for stock ledger and DC dispatches</p>
            </div>
          </div>
        </div>

        {/* Section 4: Operational Thresholds */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Operational SLA Thresholds</h2>
              <p className="text-xs text-slate-500">Service level agreements for Delivery Challans and Stores dispatch.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                DC Return SLA Window (Days)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={dcReturnSlaDays}
                onChange={(e) => setDcReturnSlaDays(parseInt(e.target.value, 10) || 7)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1.5">Days before outbound vendor DC is flagged overdue</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Material Issue SLA (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="168"
                value={materialIssueOverdueHours}
                onChange={(e) => setMaterialIssueOverdueHours(parseInt(e.target.value, 10) || 48)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1.5">Hours before approved requisition is flagged delayed</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                MSL Check Frequency (Hours)
              </label>
              <input
                type="number"
                min="1"
                max="72"
                value={mslCheckIntervalHours}
                onChange={(e) => setMslCheckIntervalHours(parseInt(e.target.value, 10) || 24)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
              <p className="text-xs text-slate-400 mt-1.5">Automated background evaluation cycle period</p>
            </div>
          </div>
        </div>
      </div>
  );
}
