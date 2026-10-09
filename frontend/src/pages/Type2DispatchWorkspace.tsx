import { PackageOpen } from 'lucide-react';
import { Type2DispatchView } from '../components/dispatch/Type2DispatchView';

export function Type2DispatchWorkspace() {
  return (
    <div className="max-w-[1600px] mx-auto w-full relative">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <PackageOpen className="w-6 h-6 text-primary" />
            DC Type 2: General Inventory Outward
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Dispatch general inventory directly to vendors.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <Type2DispatchView />
      </div>
    </div>
  );
}
