import { AlertOctagon, AlertTriangle, Clock, Activity } from 'lucide-react';
import { KpiMetricCard } from '../components/dashboard/KpiMetricCard';
import { MslExceptionGrid } from '../components/inventory/MslExceptionGrid';

export function MslAlertsWorkspace() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">MSL Alerts</h1>
        <p className="text-slate-500 mt-1 text-sm">Automated real-time threshold monitoring and safety buffer guardrails</p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            title="Critical Breaches"
            value="04"
            icon={<AlertOctagon className="w-5 h-5" />}
            statusLabel="Zero Stock / Stockout Risk"
            colorScheme="critical"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            title="Low Stock Alerts"
            value="10"
            icon={<AlertTriangle className="w-5 h-5" />}
            statusLabel="Below Safety Buffer"
            colorScheme="warning"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            title="Pending Indents"
            value="28"
            icon={<Clock className="w-5 h-5" />}
            statusLabel="In Purchase Workflow"
            colorScheme="info"
          />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-3">
          <KpiMetricCard
            title="Inventory Health Index"
            value="91.4%"
            icon={<Activity className="w-5 h-5" />}
            statusLabel="Target: >90.0% Optimal"
            colorScheme="success"
          />
        </div>
      </div>
      
      <div className="mt-2">
        <h2 className="text-lg font-bold text-slate-800 mb-4 tracking-tight">Live Exceptions</h2>
        <MslExceptionGrid />
      </div>
    </div>
  );
}
