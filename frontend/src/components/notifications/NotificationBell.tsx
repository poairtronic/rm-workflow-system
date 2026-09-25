import React, { useState } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationPanel } from './NotificationPanel';

interface NotificationBellProps {
  onNavigateTarget?: (targetEntity?: string | null, targetId?: string | null) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateTarget }) => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    loading,
    error,
    page,
    totalPages,
    refetch,
    setPage,
  } = useNotifications({ pollIntervalMs: 60000 }); // Polling every 60s (gentle, non-aggressive)

  const togglePanel = () => {
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="notification-bell-container">
      <button
        className="notification-bell-btn"
        onClick={togglePanel}
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <svg
          className="bell-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="bell-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          loading={loading}
          error={error}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onRefresh={refetch}
          onClose={() => setIsOpen(false)}
          onNavigateTarget={onNavigateTarget}
        />
      )}
    </div>
  );
};
