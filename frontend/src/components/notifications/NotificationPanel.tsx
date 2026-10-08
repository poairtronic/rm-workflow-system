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
      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 flex flex-col max-h-[85vh] overflow-hidden"
      role="dialog"
      aria-label="Notifications Panel"
      aria-modal="true"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-slate-800">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium text-primary bg-primary/10 rounded-full">{unreadCount} unread</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && onMarkAllAsRead && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onMarkAllAsRead}
              disabled={loading}
              aria-label="Mark all notifications as read"
              className="py-1! px-2! text-xs! h-7"
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
            className="p-1! h-7 w-7 flex items-center justify-center"
          >
            ↻
          </Button>
          <button
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            onClick={onClose}
            aria-label="Close notifications panel"
          >
            ✕
          </button>
        </div>
      </div>

      {onFilterChange && (
        <div className="flex px-4 border-b border-slate-100 bg-white" role="tablist" aria-label="Notification history filters">
          <button
            role="tab"
            aria-selected={filter === 'ALL'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === 'ALL' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => onFilterChange('ALL')}
          >
            All
          </button>
          <button
            role="tab"
            aria-selected={filter === 'UNREAD'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${filter === 'UNREAD' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => onFilterChange('UNREAD')}
          >
            Unread {unreadCount > 0 && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
          </button>
          <button
            role="tab"
            aria-selected={filter === 'READ'}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${filter === 'READ' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => onFilterChange('READ')}
          >
            Read
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white min-h-75">
        {loading && notifications.length === 0 ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner label="Loading notifications..." size="md" />
          </div>
        ) : error ? (
          <div className="p-4">
            <StatusAlert type="error" title="Error" message={error} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex items-center justify-center py-16 px-4">
            <EmptyState
              icon="🔔"
              title={emptyState.title}
              description={emptyState.description}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedNotifications.map((group) => (
              <div key={group.label} className="pb-2">
                <div className="px-4 py-2.5 bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10 backdrop-blur-sm">{group.label}</div>
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || loading}
            aria-label="Previous notifications page"
          >
            Previous
          </Button>
          <span className="text-xs font-medium text-slate-500">
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
