import { Send, Info } from 'lucide-react';
import { Type1DispatchWizard } from '../components/dispatch/Type1DispatchWizard';

export function Type1DispatchWorkspace() {
  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Send className="w-6 h-6 text-primary" />
            DC Type 1: Production Process Outward
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch material for external vendor processing (includes SC, Process, SLA, and Dispatch Groups).
          </p>
        </div>
      </div>

      {/* Stock Boundary Banner */}
      <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-xl flex items-start gap-3 shadow-xs text-amber-900">
        <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm leading-relaxed">
          <span className="font-semibold text-amber-950">Stock Boundary Notice: </span>
          Type 1 dispatch tracks WIP externally. Raw stock balance is not reduced — material was already issued to production.
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <Type1DispatchWizard />
      </div>
    </div>
  );
}
