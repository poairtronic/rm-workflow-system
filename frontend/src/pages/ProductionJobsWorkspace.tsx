import { PlaySquare } from 'lucide-react';

export function ProductionJobsWorkspace() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto text-center mt-20">
        <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <PlaySquare className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Active Jobs</h1>
        <p className="text-slate-600 max-w-lg mx-auto">
          The interface for tracking active production jobs is pending development.
        </p>
      </div>
    </div>
  );
}
