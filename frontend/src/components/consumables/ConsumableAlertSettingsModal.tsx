import { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  Clock,
  Send,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { consumablesApi } from '../../services/consumables.service';
import toast from 'react-hot-toast';

interface ConsumableAlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function ConsumableAlertSettingsModal({
  isOpen,
  onClose,
  onSaved,
}: ConsumableAlertSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runningSweep, setRunningSweep] = useState(false);

  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [receiptOverdueEnabled, setReceiptOverdueEnabled] = useState(true);
  const [partiallyIssuedEnabled, setPartiallyIssuedEnabled] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await consumablesApi.getAlertSettings();
      if (res) {
        setEmailAlertsEnabled(res.consumableEmailAlertsEnabled ?? true);
        setReceiptOverdueEnabled(res.consumableReceiptOverdueAlertsEnabled ?? true);
        setPartiallyIssuedEnabled(res.consumablePartiallyIssuedAlertsEnabled ?? true);
      }
    } catch (err: any) {
      console.warn('Failed to load alert settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await consumablesApi.updateAlertSettings({
        consumableEmailAlertsEnabled: emailAlertsEnabled,
        consumableReceiptOverdueAlertsEnabled: receiptOverdueEnabled,
        consumablePartiallyIssuedAlertsEnabled: partiallyIssuedEnabled,
      });
      toast.success('Consumable alert configuration saved successfully!');
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update alert settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRunSweepNow = async () => {
    setRunningSweep(true);
    try {
      const res = await consumablesApi.checkSlaAlerts();
      toast.success(
        `Sweep executed! Checked ${res.checkedCount} items: ${res.overdueReceiptCount} overdue receipt alert(s), ${res.partiallyIssuedCount} partially issued alert(s).`,
        { duration: 5000 }
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to trigger consumable SLA sweep');
    } finally {
      setRunningSweep(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between border-b border-indigo-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Bell className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide flex items-center gap-2">
                Consumables SLA &amp; Notification Alerts
              </h3>
              <p className="text-[11px] text-slate-300">
                Configure automated In-App &amp; Email alerts for overdue receipts and partial deliveries
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <span className="text-xs">Loading alert configuration...</span>
            </div>
          ) : (
            <>
              {/* Alert 1: Master Email Toggle */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white block">
                      Admin Email Notification Dispatch
                    </span>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      Master toggle to turn email notifications ON or OFF for consumable alerts (sent to Stores, Admin &amp; Production).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEmailAlertsEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    emailAlertsEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      emailAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Alert 2: 24h Receipt Overdue SLA */}
              <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        24h Unreceived Overdue Alert
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        &gt;24 Hours SLA
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Triggers in-app notification bell and email when consumables are created but <strong>not physically received</strong> into Stores within 24 hours.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setReceiptOverdueEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    receiptOverdueEnabled ? 'bg-rose-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      receiptOverdueEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Alert 3: Partially Issued Consumable */}
              <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Partially Issued Alert
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                        Action Required
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      Triggers notification when an item has only been partially issued to production, notifying storekeepers to complete the remaining balance dispatch.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPartiallyIssuedEnabled((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    partiallyIssuedEnabled ? 'bg-amber-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      partiallyIssuedEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* On-Demand Sweep Section */}
              <div className="p-3.5 bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Immediate SLA Sweep
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Run SLA check now without waiting for the hourly automated cron job.
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRunSweepNow}
                  disabled={runningSweep}
                  className="shrink-0 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningSweep ? 'animate-spin' : ''}`} />
                  Run Check Now
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving} className="text-xs">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 text-xs shadow-xs cursor-pointer"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
