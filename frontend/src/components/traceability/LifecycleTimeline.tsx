import { History, Clock } from 'lucide-react';
import type { TraceabilityEvent } from '../../types/traceability.dto';
import { TimelineNodeCard } from './TimelineNodeCard';

interface LifecycleTimelineProps {
  events: TraceabilityEvent[];
}

export function LifecycleTimeline({ events }: LifecycleTimelineProps) {
  // Sort events chronologically just in case
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs p-6">
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide">
            360° Lifecycle Audit Trail
          </h2>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {events.length} Event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="py-10 text-center">
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
