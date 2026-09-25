import React, { useEffect, useRef } from 'react';
import type { InAppNotification } from '../../types/notification';
import type { NotificationHistoryFilter } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { LoadingSpinner } from '../feedback/LoadingSpinner';
import { EmptyState } from '../feedback/EmptyState';
import { StatusAlert } from '../feedback/StatusAlert';
import { Button } from '../ui/Button';

interface NotificationPanelProps {
  notifications: InAppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  filter?: NotificationHistoryFilter;
  onFilterChange?: (filter: NotificationHistoryFilter) => void;
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  onClose: () => void;
  onNavigateTarget?: (targetEntity?: string | null, targetId?: string | null) => void;
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
}

function groupNotificationsByDate(notifications: InAppNotification[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: InAppNotification[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Older', items: [] },
  ];

  notifications.forEach((item) => {
    const itemDate = new Date(item.createdAt);
    itemDate.setHours(0, 0, 0, 0);

    if (itemDate.getTime() === today.getTime()) {
      groups[0].items.push(item);
    } else if (itemDate.getTime() === yesterday.getTime()) {
      groups[1].items.push(item);
    } else {
      groups[2].items.push(item);
    }
  });

  return groups.filter((g) => g.items.length > 0);
}

const getEmptyStateDetails = (filter?: NotificationHistoryFilter) => {
  switch (filter) {
    case 'UNREAD':
      return {
        title: 'No unread notifications',
        description: 'You are all caught up! Check All or Read history.',
      };
    case 'READ':
      return {
        title: 'No read notifications',
        description: 'You have not read any notifications yet.',
      };
    case 'ALL':
    default:
      return {
        title: 'No notifications yet',
        description: 'You will be notified when workflow updates occur.',
      };
  }
};

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  unreadCount,
  loading,
  error,
  page,
  totalPages,
  filter = 'ALL',
  onFilterChange,
  onPageChange,
  onRefresh,
  onClose,
  onNavigateTarget,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on Esc key or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const groupedNotifications = groupNotificationsByDate(notifications);
  const emptyState = getEmptyStateDetails(filter);

  return (
    <div
      ref={panelRef}
      className="notification-panel"
      role="dialog"
      aria-label="Notifications Panel"
      aria-modal="true"
    >
      <div className="notification-panel-header">
        <div className="panel-title-area">
          <h3 className="panel-title">Notifications</h3>
          {unreadCount > 0 && (
            <span className="unread-count-pill">{unreadCount} unread</span>
          )}
        </div>
        <div className="panel-action-area">
          {unreadCount > 0 && onMarkAllAsRead && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={loading}
              aria-label="Mark all notifications as read"
            >
              Mark all read
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Refresh notifications"
          >
            ↻
          </Button>
          <button
            className="close-panel-btn"
            onClick={onClose}
            aria-label="Close notifications panel"
          >
            ✕
          </button>
        </div>
      </div>

      {onFilterChange && (
        <div className="notification-filter-tabs" role="tablist" aria-label="Notification history filters">
          <button
            role="tab"
            aria-selected={filter === 'ALL'}
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => onFilterChange('ALL')}
          >
            All
          </button>
          <button
            role="tab"
            aria-selected={filter === 'UNREAD'}
            className={`filter-tab ${filter === 'UNREAD' ? 'active' : ''}`}
            onClick={() => onFilterChange('UNREAD')}
          >
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            role="tab"
            aria-selected={filter === 'READ'}
            className={`filter-tab ${filter === 'READ' ? 'active' : ''}`}
            onClick={() => onFilterChange('READ')}
          >
            Read
          </button>
        </div>
      )}

      <div className="notification-panel-body">
        {loading && notifications.length === 0 ? (
          <div className="panel-loading-wrapper">
            <LoadingSpinner label="Loading notifications..." size="md" />
          </div>
        ) : error ? (
          <div className="panel-error-wrapper">
            <StatusAlert type="error" title="Error" message={error} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="panel-empty-wrapper">
            <EmptyState
              icon="🔔"
              title={emptyState.title}
              description={emptyState.description}
            />
          </div>
        ) : (
          <div className="notification-list">
            {groupedNotifications.map((group) => (
              <div key={group.label} className="notification-date-group">
                <div className="notification-date-group-header">{group.label}</div>
                {group.items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onNavigateTarget={onNavigateTarget}
                    onMarkAsRead={onMarkAsRead}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="notification-panel-footer">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Previous notifications page"
          >
            Previous
          </Button>
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || loading}
            aria-label="Next notifications page"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};
