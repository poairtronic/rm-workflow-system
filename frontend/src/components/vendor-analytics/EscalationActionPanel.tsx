import { ChevronDown } from 'lucide-react';
import type { VendorCustodyItem } from '../../types/vendor-analytics.dto';

interface EscalationActionPanelProps {
  item: VendorCustodyItem;
}

export function EscalationActionPanel({ item }: EscalationActionPanelProps) {
  if (!item.isOverdue) {
    return <span className="text-slate-400 text-xs">-</span>;
  }

  return (
    <div className="relative">
      <button
        disabled
        title="Not available yet"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed"
      >
        Escalate
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
