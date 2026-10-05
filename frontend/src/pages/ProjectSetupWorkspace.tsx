import { FilePlus } from 'lucide-react';

export function ProjectSetupWorkspace() {
  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto text-center mt-20">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
          <FilePlus className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Project Setup</h1>
        <p className="text-slate-600 max-w-lg mx-auto">
          The Design Engineering module for creating POs and SCs is currently under construction. Please check back later or proceed to the next development phase.
        </p>
      </div>
    </div>
  );
}
