import { Bell } from 'lucide-react';

export function AlertSettingsPanel() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 opacity-80">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <Bell className="w-5 h-5 text-slate-500" />
        <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">Proactive Alert Settings (Coming Soon)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800">Pre-breach Thresholds</h3>
          <p className="text-xs text-slate-500 mb-4">Select when chaser notifications should be sent to the vendor prior to SLA expiry.</p>
          
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-400">72 Hours Before</span>
            <input type="checkbox" disabled title="Not saved yet" className="w-4 h-4 rounded border-slate-200 bg-slate-100 cursor-not-allowed" />
          </div>
          
          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-400">48 Hours Before</span>
            <input type="checkbox" disabled title="Not saved yet" className="w-4 h-4 rounded border-slate-200 bg-slate-100 cursor-not-allowed" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
            <span className="text-sm font-medium text-slate-400">24 Hours Before</span>
            <input type="checkbox" disabled title="Not saved yet" className="w-4 h-4 rounded border-slate-200 bg-slate-100 cursor-not-allowed" />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-800">Communication Channels</h3>
          <p className="text-xs text-slate-500 mb-4">Enable or disable automated delivery methods.</p>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-400">Email Notifications</p>
              <p className="text-xs text-slate-400">Send chasers via vendor contact email.</p>
            </div>
            <button
              type="button"
              disabled
              title="Not saved yet"
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200"
            >
              <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0" />
            </button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-slate-200">
            <div>
              <p className="text-sm font-medium text-slate-400">SMS Alerts</p>
              <p className="text-xs text-slate-400">Send urgent chasers via text message.</p>
            </div>
            <button
              type="button"
              disabled
              title="Not saved yet"
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-not-allowed rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out bg-slate-200"
            >
              <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
