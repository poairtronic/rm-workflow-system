import { PackageSearch } from 'lucide-react';

export function ProductionConsumptionWorkspace() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto text-center mt-20">
        <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <PackageSearch className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Material Consumption</h1>
        <p className="text-slate-600 max-w-lg mx-auto">
          The interface for logging material consumption and scrap is pending development.
        </p>
      </div>
    </div>
  );
}
