import React from 'react';

export interface AuditEvent {
  id: string;
  timestamp: string;
  stage: string;
  actorName: string;
  role: string;
  actionText: string;
  remarks?: string;
}

interface AuditTimelineProps {
  events: AuditEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (events.length === 0) {
    return <div className="timeline-empty">No material movement recorded yet.</div>;
  }

  return (
    <div className="audit-timeline">
      {events.map((event, idx) => (
        <div key={event.id || idx} className="timeline-item">
          <div className="timeline-marker" />
          <div className="timeline-content">
            <div className="timeline-header">
              <span className="timeline-time">{event.timestamp}</span>
              <span className="timeline-stage">{event.stage}</span>
              <span className="timeline-actor">
                {event.actorName} ({event.role})
              </span>
            </div>
            <p className="timeline-action">{event.actionText}</p>
            {event.remarks && <p className="timeline-remarks">“{event.remarks}”</p>}
          </div>
        </div>
      ))}
    </div>
  );
};
