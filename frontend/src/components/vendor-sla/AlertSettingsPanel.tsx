import { useFormContext } from 'react-hook-form';
import type { CreateVendorSlaDto } from '../../types/vendor-sla.dto';
import { Bell } from 'lucide-react';

export function AlertSettingsPanel() {
  const { register, watch, setValue } = useFormContext<CreateVendorSlaDto>();
  
  const emailEnabled = watch('emailAlertsEnabled');
  const smsEnabled = watch('smsAlertsEnabled');

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <Bell className="w-5 h-5 text-slate-500" />
        <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Proactive Alert Settings</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800">Pre-breach Thresholds</h3>
          <p className="text-xs text-slate-500 mb-4">Select when chaser notifications should be sent to the vendor prior to SLA expiry.</p>
          
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-700">72 Hours Before</span>
            <input type="checkbox" {...register('alert72h')} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-700">48 Hours Before</span>
            <input type="checkbox" {...register('alert48h')} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-700">24 Hours Before</span>
            <input type="checkbox" {...register('alert24h')} className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800">Communication Channels</h3>
          <p className="text-xs text-slate-500 mb-4">Enable or disable automated delivery methods.</p>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-900">Email Notifications</p>
              <p className="text-xs text-slate-500">Send chasers via vendor contact email.</p>
            </div>
            <button
              type="button"
              onClick={() => setValue('emailAlertsEnabled', !emailEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                emailEnabled ? 'bg-primary-secondary' : 'bg-slate-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-900">SMS Alerts</p>
              <p className="text-xs text-slate-500">Send urgent chasers via text message.</p>
            </div>
            <button
              type="button"
              onClick={() => setValue('smsAlertsEnabled', !smsEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                smsEnabled ? 'bg-primary-secondary' : 'bg-slate-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${smsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
