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
    if (targetEntity && targetId && onNavigateTarget) {
      onNavigateTarget(targetEntity, targetId);
    }
  };

  return (
    <div
      className={`notification-item ${isRead ? 'read' : 'unread'}`}
      tabIndex={0}
      role="article"
      aria-label={`${isRead ? 'Read' : 'Unread'} notification: ${title}`}
      onClick={handleClick}
    >
      <div className="notification-item-header">
        <div className="notification-type-badge-group">
          {!isRead && <span className="unread-dot" title="Unread notification" />}
          <span className={`notification-type-tag type-${type.toLowerCase()}`}>
            {formattedType}
          </span>
        </div>
        <span className="notification-time">{formattedTime}</span>
      </div>

      <h4 className="notification-item-title">{title}</h4>
      <p className="notification-item-message">{message}</p>

      {targetEntity && targetId && (
        <div className="notification-target-info">
          <span className="target-badge">
            {targetEntity}: {targetId}
          </span>
        </div>
      )}
    </div>
  );
};
