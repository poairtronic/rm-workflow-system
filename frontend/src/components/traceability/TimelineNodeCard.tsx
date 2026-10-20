import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, FileText, Box, Truck, CheckSquare, ClipboardList, RefreshCw } from 'lucide-react';
import type { TraceabilityEvent } from '../../types/traceability.dto';

interface TimelineNodeCardProps {
  event: TraceabilityEvent;
  isLast: boolean;
  forceExpand?: boolean;
}

export function TimelineNodeCard({ event, isLast, forceExpand }: TimelineNodeCardProps) {
  const [isExpanded, setIsExpanded] = useState(forceExpand ?? false);

  useEffect(() => {
    if (forceExpand !== undefined) {
      setIsExpanded(forceExpand);
    }
  }, [forceExpand]);

  const getIcon = () => {
    switch (event.type) {
      case 'ORDER_CREATED': return FileText;
      case 'RM_REQUESTED': return ClipboardList;
      case 'MATERIAL_ISSUED': return Box;
      case 'DISPATCH_TYPE_1': return Truck;
      case 'DC_RETURNED': return RefreshCw;
      case 'FINAL_INSPECTION': return CheckSquare;
      default: return Box;
    }
  };

  const getTheme = () => {
    switch (event.type) {
      case 'ORDER_CREATED': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'RM_REQUESTED': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'MATERIAL_ISSUED': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'DISPATCH_TYPE_1': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'DC_RETURNED': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'FINAL_INSPECTION': return 'text-teal-600 bg-teal-50 border-teal-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const Icon = getIcon();
  const theme = getTheme();

  // Extract key quick facts for immediate display
  const keyDetail =
    event.details?.totalQuantityIssued
      ? `Issued: ${event.details.totalQuantityIssued}`
      : event.details?.dispatchedQuantity
      ? `Dispatched: ${event.details.dispatchedQuantity}`
      : event.details?.returnedQuantity
      ? `Returned: ${event.details.returnedQuantity}`
      : event.details?.consumedQuantity
      ? `Consumed: ${event.details.consumedQuantity}`
      : event.details?.totalQuantityReceived
      ? `Received: ${event.details.totalQuantityReceived}`
      : null;

  return (
    <div className="relative pl-12 pb-8">
      {/* Timeline Line */}
      {!isLast && (
        <div className="absolute left-5 top-10 bottom-0 w-0.5 bg-slate-200 -translate-x-1/2"></div>
      )}
      
      {/* Timeline Icon */}
      <div className={`absolute left-5 top-0 -translate-x-1/2 w-10 h-10 rounded-full flex items-center justify-center border-2 ${theme} z-10 bg-white`}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Card Content */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden transition-all hover:border-slate-300 hover:shadow-md">
        {/* Header (Always Visible) */}
        <div 
          className="px-6 py-4 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900">{event.title}</h3>
              {keyDetail && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {keyDetail}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="tabular-nums font-semibold text-slate-700">
                {new Date(event.timestamp).toLocaleString()}
              </span>
              <span>•</span>
              <span className="font-medium text-slate-600">{event.actor}</span>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Expanded Details */}
        {isExpanded && Object.keys(event.details).length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-6">
            {Object.entries(event.details).map(([key, value]) => (
              <div key={key} className="bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
                <p className="text-xs font-semibold text-slate-900 tabular-nums break-words">
                  {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
