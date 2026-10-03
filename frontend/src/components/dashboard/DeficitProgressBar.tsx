export type SeverityLevel = 'CRITICAL' | 'LOW_STOCK';

interface Props {
  currentStock: number;
  mslThreshold: number;
  unit: string;
  severity: SeverityLevel;
}

export function DeficitProgressBar({ currentStock, mslThreshold, unit, severity }: Props) {
  const percentage = Math.min(Math.max((currentStock / mslThreshold) * 100, 0), 100);
  const deficit = mslThreshold - currentStock;

  const isCritical = severity === 'CRITICAL';
  const fillColor = isCritical ? 'bg-red-600' : 'bg-amber-500';
  const textColor = isCritical ? 'text-red-600' : 'text-amber-600';

  return (
    <div className="flex flex-col gap-1 w-full max-w-[200px]">
      <div className="flex justify-between items-center text-[12px] font-medium tabular-nums">
        <span className="text-slate-500">{currentStock.toFixed(1)} {unit}</span>
        <span className={textColor}>
          -{deficit.toFixed(1)} {unit}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ease-in-out ${fillColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
