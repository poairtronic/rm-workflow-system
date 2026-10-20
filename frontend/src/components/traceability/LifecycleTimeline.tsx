import { useState } from 'react';
import { History, Clock, Truck, RefreshCw, Box, ChevronDown, ChevronUp } from 'lucide-react';
import type { TraceabilityEvent } from '../../types/traceability.dto';
import { TimelineNodeCard } from './TimelineNodeCard';

interface LifecycleTimelineProps {
  events: TraceabilityEvent[];
}

export function LifecycleTimeline({ events }: LifecycleTimelineProps) {
  const [expandAll, setExpandAll] = useState(false);

  // Sort events chronologically: oldest first
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Calculate high-level summary metrics
  const issueEvents = sortedEvents.filter((e) => e.type === 'MATERIAL_ISSUED');
  const vendorDispatches = sortedEvents.filter((e) => e.type === 'DISPATCH_TYPE_1');
  const vendorReturns = sortedEvents.filter((e) => e.type === 'DC_RETURNED');
  const firstIssueDate = issueEvents[0]?.timestamp
    ? new Date(issueEvents[0].timestamp).toLocaleString()
    : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-bold text-slate-900 uppercase tracking-wide">
            360° Lifecycle Audit Trail
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            {events.length} Event{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        {events.length > 0 && (
          <button
            type="button"
            onClick={() => setExpandAll(!expandAll)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer self-start sm:self-auto"
          >
            {expandAll ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Collapse All Details
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Expand All Details
              </>
            )}
          </button>
        )}
      </div>

      {/* Quick Summary Highlights for Auditor */}
      {events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs">
          {/* Material Issue Milestone */}
          <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200/70">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Box className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Material Issue Milestone
              </p>
              <p className="font-bold text-slate-800 tabular-nums">
                {firstIssueDate || 'Pending Stores Issue'}
              </p>
            </div>
          </div>

          {/* Sent to Vendor Count */}
          <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200/70">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Vendor Dispatches
              </p>
              <p className="font-bold text-slate-800">
                {vendorDispatches.length}{' '}
                {vendorDispatches.length === 1 ? 'time' : 'times'} sent to vendor
              </p>
            </div>
          </div>

          {/* Vendor Receipts / Returns */}
          <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200/70">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Vendor Receipts & Returns
              </p>
              <p className="font-bold text-slate-800">
                {vendorReturns.length}{' '}
                {vendorReturns.length === 1 ? 'inward return' : 'inward returns'}
              </p>
            </div>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <div className="py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Clock className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No traceability events recorded yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Lifecycle events will appear here in chronological order as materials are requested, issued, subcontracted, and inspected.
          </p>
        </div>
      ) : (
        <div className="pt-2 pl-2">
          {sortedEvents.map((event, index) => (
            <TimelineNodeCard
              key={event.id}
              event={event}
              isLast={index === sortedEvents.length - 1}
              forceExpand={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
