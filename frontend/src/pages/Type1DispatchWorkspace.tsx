import { Send } from 'lucide-react';
import { Type1DispatchWizard } from '../components/dispatch/Type1DispatchWizard';

export function Type1DispatchWorkspace() {
  return (
    <div className="max-w-[1600px] mx-auto w-full">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            DC Type 2: Material in Process
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch material in the production line undergoing a process to vendors (includes SC, Process, SLA).
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <Type1DispatchWizard />
      </div>
    </div>
  );
}
