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
            DC Type 1: Production Outward
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch raw materials to external vendors for manufacturing processes.
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
