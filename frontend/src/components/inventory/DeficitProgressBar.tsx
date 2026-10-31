

export interface DeficitProgressBarProps {
  currentStock: number;
  mslThreshold: number;
  unit: string;
  severity: 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW_STOCK' | 'GOOD';
}

export function DeficitProgressBar({
  currentStock,
  mslThreshold,
  unit,
  severity,
}: DeficitProgressBarProps) {
  // Good / Healthy stock level: stock is at or above MSL
  if (severity === 'GOOD' || currentStock >= mslThreshold) {
    const surplus = Math.max(0, currentStock - mslThreshold);
    return (
      <div className="flex flex-col gap-1.5 w-full max-w-[120px] ml-auto">
        <div className="flex items-center justify-end">
          <span className="text-xs font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
            +{surplus.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-in-out"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    );
  }

  // Calculate deficit percentage relative to MSL, capped at 100%
  const safeMsl = mslThreshold > 0 ? mslThreshold : 1;
  const deficit = Math.max(mslThreshold - currentStock, 0);
  const deficitPercentage = Math.min(Math.max((deficit / safeMsl) * 100, 0), 100);

  // Semantic styles based on severity: Critical / Out of Stock are Red, Low Stock is Amber
  const isCritical = severity === 'CRITICAL' || severity === 'OUT_OF_STOCK';
  const fillColor = isCritical ? 'bg-rose-600' : 'bg-amber-500';
  const textColor = isCritical ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400';

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-[120px] ml-auto">
      <div className="flex items-center justify-end">
        <span className={`text-xs font-medium tabular-nums ${textColor}`}>
          -{deficit.toLocaleString(undefined, { maximumFractionDigits: 1 })} {unit}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-in-out ${fillColor}`}
          style={{ width: `${deficitPercentage}%` }}
        />
      </div>
    </div>
  );
}
