import React from 'react';
import type { InAppNotification } from '../../types/notification';
import { formatNotificationType } from '../../types/notification';

interface NotificationItemProps {
  notification: InAppNotification;
  onNavigateTarget?: (targetEntity?: string | null, targetId?: string | null) => void;
  onMarkAsRead?: (id: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onNavigateTarget,
  onMarkAsRead,
}) => {
  const { id, title, message, type, targetEntity, targetId, isRead, createdAt } = notification;

  const formattedType = formatNotificationType(type);
  const formattedTime = new Date(createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleClick = () => {
    if (!isRead && onMarkAsRead) {
      onMarkAsRead(id);
    }
    if (targetEntity && onNavigateTarget) {
      onNavigateTarget(targetEntity, targetId);
    }
  };

  return (
    <div
      className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors outline-none focus:bg-slate-50 ${!isRead ? 'bg-primary/5' : ''}`}
      tabIndex={0}
      role="article"
      aria-label={`${isRead ? 'Read' : 'Unread'} notification: ${title}`}
      onClick={handleClick}
      onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {!isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Unread notification" />}
          <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
            {formattedType}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-400">{formattedTime}</span>
      </div>

      <h4 className="text-sm font-semibold text-slate-900 mb-1 leading-tight">{title}</h4>
      <p className="text-sm text-slate-600 leading-snug">{message}</p>

      {targetEntity && targetId && (
        <div className="mt-3">
          <span className="inline-block px-2 py-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded">
            {targetEntity}: {targetId}
          </span>
        </div>
      )}
    </div>
  );
};
