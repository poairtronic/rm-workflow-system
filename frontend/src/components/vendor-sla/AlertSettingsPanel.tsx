import { useFormContext } from 'react-hook-form';
import { Bell, Mail, MessageSquare } from 'lucide-react';
import type { CreateVendorSlaDto } from '../../types/vendor-sla.dto';

export function AlertSettingsPanel() {
  const { register, watch, setValue } = useFormContext<CreateVendorSlaDto>();

  const emailAlertsEnabled = watch('emailAlertsEnabled');
  const smsAlertsEnabled = watch('smsAlertsEnabled');

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <Bell className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900 tracking-tight">Proactive Alert & Chaser Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">Automated notification triggers prior to SLA target expiry</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Pre-breach Thresholds</h3>
            <p className="text-xs text-slate-500 mt-0.5">Select when chaser notifications should trigger before SLA deadline.</p>
          </div>
          
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
            <span className="text-sm font-medium text-slate-700">72 Hours Before</span>
            <input
              type="checkbox"
              {...register('alert72h')}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
            />
          </label>
          
          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
            <span className="text-sm font-medium text-slate-700">48 Hours Before</span>
            <input
              type="checkbox"
              {...register('alert48h')}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 cursor-pointer transition-colors">
            <span className="text-sm font-medium text-slate-700">24 Hours Before</span>
            <input
              type="checkbox"
              {...register('alert24h')}
              className="w-4 h-4 rounded text-primary focus:ring-primary border-slate-300 cursor-pointer"
            />
          </label>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Communication Channels</h3>
            <p className="text-xs text-slate-500 mt-0.5">Configure notification delivery methods for operations.</p>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50/40">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">Email Notifications</p>
                <p className="text-xs text-slate-500">Send chasers to registered vendor email.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setValue('emailAlertsEnabled', !emailAlertsEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                emailAlertsEnabled ? 'bg-primary' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  emailAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-50/40">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-slate-500" />
              <div>
                <p className="text-sm font-medium text-slate-800">SMS Alerts</p>
                <p className="text-xs text-slate-500">Send high-priority SMS chasers.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setValue('smsAlertsEnabled', !smsAlertsEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                smsAlertsEnabled ? 'bg-primary' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  smsAlertsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
