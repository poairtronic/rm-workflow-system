import type { ReactNode } from 'react';

export type KpiColorScheme = 'critical' | 'warning' | 'info' | 'success';

interface KpiMetricCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  statusLabel: string;
  colorScheme: KpiColorScheme;
}

const colorMap = {
  critical: {
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    labelBg: 'bg-red-50',
    labelColor: 'text-red-700',
  },
  warning: {
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    labelBg: 'bg-amber-50',
    labelColor: 'text-amber-700',
  },
  info: {
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    labelBg: 'bg-blue-50',
    labelColor: 'text-blue-700',
  },
  success: {
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    labelBg: 'bg-green-50',
    labelColor: 'text-green-700',
  }
};

export function KpiMetricCard({ title, value, icon, statusLabel, colorScheme }: KpiMetricCardProps) {
  const scheme = colorMap[colorScheme];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_3px_0_rgba(0,0,0,0.05),0_1px_2px_-1px_rgba(0,0,0,0.05)] flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <h3 className="text-[12px] uppercase tracking-wide text-slate-500 font-semibold">{title}</h3>
        <div className={`p-2 rounded-lg ${scheme.iconBg} ${scheme.iconColor}`}>
          {icon}
        </div>
      </div>
      
      <div className="mt-4">
        <div className="text-[24px] font-bold tabular-nums text-slate-900 leading-none">
          {value}
        </div>
        <div className="mt-2.5 flex items-center">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${scheme.labelBg} ${scheme.labelColor}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
