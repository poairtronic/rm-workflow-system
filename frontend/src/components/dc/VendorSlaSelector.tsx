import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Clock } from 'lucide-react';
import { api, unwrapList } from '../../services/api';

export interface VendorSlaSelectorProps {
  vendorId?: string;
  processId?: string;
  slaDays?: number;
  isFallback?: boolean;
  className?: string;
  showIcon?: boolean;
  badgeMode?: boolean;
  slaList?: any[];
}

export interface VendorSlaResolution {
  slaDays: number;
  isFallback: boolean;
  displayText: string;
}

/**
 * Resolves the SLA days for a given vendor and process combination.
 * If no SLA exists for the combo, defaults to 7 days with isFallback = true.
 */
export function resolveVendorSla(
  vendorId?: string,
  processId?: string,
  slaList?: any[],
): VendorSlaResolution {
  if (vendorId && processId && Array.isArray(slaList)) {
    const matched = slaList.find(
      (s: any) => s.vendorId === vendorId && s.processId === processId,
    );
    if (matched && typeof matched.slaDays === 'number' && matched.slaDays > 0) {
      return {
        slaDays: matched.slaDays,
        isFallback: false,
        displayText: `${matched.slaDays} days`,
      };
    }
  }

  // Fallback default: 7 days
  return {
    slaDays: 7,
    isFallback: true,
    displayText: 'Default (7 days)',
  };
}

export function VendorSlaSelector({
  vendorId,
  processId,
  slaDays: propSlaDays,
  isFallback: propIsFallback,
  className = '',
  showIcon = true,
  badgeMode = false,
  slaList: propSlaList,
}: VendorSlaSelectorProps) {
  // If slaList is not provided as a prop, query it from the vendor SLAs endpoint
  const { data: fetchedSlaList } = useQuery({
    queryKey: ['vendor-slas'],
    queryFn: async () => unwrapList(await api.get<any[]>('/api/vendors/slas')),
    enabled: propSlaList === undefined && propSlaDays === undefined,
    staleTime: 60000,
  });

  const slaList = propSlaList || fetchedSlaList || [];

  const resolution = useMemo(() => {
    // If explicitly provided via props, honour them
    if (propSlaDays !== undefined) {
      const isFallback =
        propIsFallback !== undefined ? propIsFallback : propSlaDays === 7;
      return {
        slaDays: propSlaDays,
        isFallback,
        displayText: isFallback ? 'Default (7 days)' : `${propSlaDays} days`,
      };
    }

    return resolveVendorSla(vendorId, processId, slaList);
  }, [propSlaDays, propIsFallback, vendorId, processId, slaList]);

  const { isFallback, displayText } = resolution;

  if (badgeMode) {
    if (isFallback) {
      return (
        <span
          data-testid="vendor-sla-fallback-badge"
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 ${className}`}
        >
          {showIcon && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />}
          <span>{displayText}</span>
        </span>
      );
    }

    return (
      <span
        data-testid="vendor-sla-configured-badge"
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 ${className}`}
      >
        {showIcon && <Clock className="w-3 h-3 text-slate-500 shrink-0" />}
        <span>{displayText}</span>
      </span>
    );
  }

  // Standard inline rendering
  if (isFallback) {
    return (
      <span
        data-testid="vendor-sla-fallback-text"
        className={`inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 ${className}`}
      >
        {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
        <span>{displayText}</span>
      </span>
    );
  }

  return (
    <span
      data-testid="vendor-sla-configured-text"
      className={`inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 ${className}`}
    >
      {showIcon && <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
      <span>{displayText}</span>
    </span>
  );
}

export default VendorSlaSelector;
