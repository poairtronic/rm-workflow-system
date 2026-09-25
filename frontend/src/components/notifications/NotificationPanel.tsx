import React, { useEffect, useRef } from 'react';
import type { InAppNotification } from '../../types/notification';
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
  onPageChange: (newPage: number) => void;
  onRefresh: () => void;
  onClose: () => void;
  onNavigateTarget?: (targetEntity?: string | null, targetId?: string | null) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  notifications,
  unreadCount,
  loading,
  error,
  page,
  totalPages,
  onPageChange,
  onRefresh,
  onClose,
  onNavigateTarget,
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
              title="No notifications yet"
              description="You will be notified when workflow updates occur."
            />
          </div>
        ) : (
          <div className="notification-list">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onNavigateTarget={onNavigateTarget}
              />
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
