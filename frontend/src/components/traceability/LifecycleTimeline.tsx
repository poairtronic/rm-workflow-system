import type { TraceabilityEvent } from '../../types/traceability.dto';
import { TimelineNodeCard } from './TimelineNodeCard';

interface LifecycleTimelineProps {
  events: TraceabilityEvent[];
}

export function LifecycleTimeline({ events }: LifecycleTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center">
        <p className="text-sm text-slate-500">No traceability events found for this component.</p>
      </div>
    );
  }

  // Sort events chronologically just in case
  const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-[15px] font-semibold text-slate-900 uppercase tracking-wide mb-6 pb-4 border-b border-slate-100">
        360° Lifecycle Audit Trail
      </h2>
      <div className="pt-2 pl-2">
        {sortedEvents.map((event, index) => (
          <TimelineNodeCard
            key={event.id}
            event={event}
            isLast={index === sortedEvents.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
