import { Layers, Warehouse, Truck, AlertTriangle } from 'lucide-react';
import type { OverviewSummaryDto } from '../../types/overview.dto';

interface OverviewHeaderMetricsProps {
  summary: OverviewSummaryDto;
}

export function OverviewHeaderMetrics({ summary }: OverviewHeaderMetricsProps) {
  const cards = [
    {
      title: 'Active Shop Floor SCs',
      value: summary.activeShopFloorScs.toLocaleString(),
      subtitle: 'In production & issued',
      icon: Layers,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100',
    },
    {
      title: 'Total Warehouse Stock',
      value: summary.totalStockQuantity.toLocaleString(),
      subtitle: 'Across all active bins',
      icon: Warehouse,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100',
    },
    {
      title: 'Vendor Custody Material',
      value: `${summary.totalCustodyUnits.toLocaleString()} units`,
      subtitle: `${summary.openDeliveryChallans} active challans outside`,
      icon: Truck,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-100',
    },
    {
      title: 'Low Stock MSL Alerts',
      value: summary.lowStockAlerts.toLocaleString(),
      subtitle: summary.lowStockAlerts > 0 ? 'Requires attention' : 'Inventory levels optimal',
      icon: AlertTriangle,
      color: summary.lowStockAlerts > 0 ? 'text-rose-600' : 'text-slate-600',
      bgColor: summary.lowStockAlerts > 0 ? 'bg-rose-50' : 'bg-slate-50',
      borderColor: summary.lowStockAlerts > 0 ? 'border-rose-100' : 'border-slate-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] sm:[grid-template-columns:none]">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.title}
            className={`p-4 sm:p-5 rounded-2xl border bg-white dark:bg-[#121526] shadow-xs flex items-start justify-between gap-3 transition-all hover:shadow-md ${c.borderColor} dark:border-[#1e233d]`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#8896ab] mb-1 truncate">
                {c.title}
              </p>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {c.value}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-[#8896ab] mt-1 sm:mt-1.5 flex items-center gap-1 truncate">
                {c.subtitle}
              </p>
            </div>
            <div className={`p-2.5 sm:p-3 rounded-xl ${c.bgColor} dark:bg-opacity-15 ${c.color} shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

