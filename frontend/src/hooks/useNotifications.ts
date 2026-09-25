import { useState, useEffect, useCallback } from 'react';
import type { InAppNotification } from '../types/notification';
import { NotificationService } from '../services/notification.service';
import { useAuth } from './useAuth';

export type NotificationHistoryFilter = 'ALL' | 'UNREAD' | 'READ';

interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  pollIntervalMs?: number;
  initialFilter?: NotificationHistoryFilter;
  initialTypeFilter?: string;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [filter, setFilter] = useState<NotificationHistoryFilter>(options?.initialFilter || 'ALL');
  const [typeFilter, setTypeFilter] = useState<string | undefined>(options?.initialTypeFilter);
  const [page, setPage] = useState<number>(options?.page || 1);
  const [limit] = useState<number>(options?.limit || 10);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (currentPage = page, currentFilter = filter, currentType = typeFilter) => {
      if (!isAuthenticated) return;

      setLoading(true);
      setError(null);

      try {
        const queryParams: any = {
          page: currentPage,
          limit,
        };

        if (currentFilter === 'UNREAD') {
          queryParams.unreadOnly = true;
        } else if (currentFilter === 'READ') {
          queryParams.readOnly = true;
        }

        if (currentType) {
          queryParams.type = currentType;
        }

        const res = await NotificationService.getNotifications(queryParams);
        setNotifications(res.data || []);
        setTotal(res.total || 0);

        // Fetch unread count for badge if in ALL or READ filter mode
        if (currentFilter === 'ALL' || currentFilter === 'READ') {
          const unreadRes = await NotificationService.getNotifications({
            page: 1,
            limit: 1,
            unreadOnly: true,
          });
          setUnreadCount(unreadRes.total || 0);
        } else {
          setUnreadCount(res.total || 0);
        }
      } catch (err: any) {
        // Sanitize error message to prevent leaking stack traces or internal secrets
        let userMessage = 'Failed to load notifications. Please try again later.';
        if (err?.message && typeof err.message === 'string') {
          if (
            !err.message.includes('SQL') &&
            !err.message.includes('jwt') &&
            !err.message.includes('Bearer') &&
            !err.message.includes('select') &&
            !err.message.includes('QueryFailedError')
          ) {
            userMessage = err.message;
          }
        }
        setError(userMessage);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, page, limit, filter, typeFilter]
  );

  useEffect(() => {
    fetchNotifications(page, filter, typeFilter);
  }, [fetchNotifications, page, filter, typeFilter]);

  // Optional background refresh (default 60 seconds)
  useEffect(() => {
    if (!isAuthenticated || !options?.pollIntervalMs) return;

    const interval = setInterval(() => {
      fetchNotifications(page, filter, typeFilter);
    }, options.pollIntervalMs);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications, page, filter, typeFilter, options?.pollIntervalMs]);

  const markAsRead = async (notificationId: string) => {
    try {
      const target = notifications.find((n) => n.id === notificationId);
      if (target && target.isRead) {
        return; // Already read, safe no-op
      }
      await NotificationService.markAsRead(notificationId);
      // Update local state without deleting item from history
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      // If active filter is UNREAD, refresh to reflect updated unread list
      if (filter === 'UNREAD') {
        fetchNotifications(page, filter, typeFilter);
      }
    } catch (err) {
      // Ignore or log error silently
    }
  };

  const markAllAsRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (filter === 'UNREAD') {
        fetchNotifications(1, filter, typeFilter);
      }
    } catch (err) {
      // Ignore or log error
    }
  };

  const handleSetFilter = (newFilter: NotificationHistoryFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleSetTypeFilter = (newType?: string) => {
    setTypeFilter(newType);
    setPage(1);
  };

  return {
    notifications,
    unreadCount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    filter,
    typeFilter,
    loading,
    error,
    refetch: () => fetchNotifications(page, filter, typeFilter),
    setPage,
    setFilter: handleSetFilter,
    setTypeFilter: handleSetTypeFilter,
    markAsRead,
    markAllAsRead,
  };
}
