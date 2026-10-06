import { LayoutDashboard } from 'lucide-react';

export function OverviewPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center animate-in fade-in duration-500">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <LayoutDashboard className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Management Overview</h2>
      <p className="text-slate-500 max-w-md">
        This dashboard will provide a high-level summary of operations and key metrics. (F8 feature)
      </p>
    </div>
  );
}
