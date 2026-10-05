import React from 'react';

export interface DeficitProgressBarProps {
  currentStock: number;
  mslThreshold: number;
  unit: string;
  severity: 'CRITICAL' | 'LOW_STOCK';
}

export function DeficitProgressBar({
  currentStock,
  mslThreshold,
  unit,
  severity,
}: DeficitProgressBarProps) {
  // Calculate deficit percentage relative to MSL, capped at 100%
  const safeMsl = mslThreshold > 0 ? mslThreshold : 1;
  const deficit = Math.max(mslThreshold - currentStock, 0);
  const deficitPercentage = Math.min(Math.max((deficit / safeMsl) * 100, 0), 100);

  // Semantic styles based on severity
  const isCritical = severity === 'CRITICAL';
  const fillColor = isCritical ? 'bg-red-600' : 'bg-amber-500';
  const textColor = isCritical ? 'text-red-700' : 'text-amber-700';

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[120px] ml-auto">
      <div className="flex items-center justify-end">
        <span className={`text-xs font-medium tabular-nums ${textColor}`}>
          -{deficit.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-in-out ${fillColor}`}
          style={{ width: `${deficitPercentage}%` }}
        />
      </div>
    </div>
  );
}
