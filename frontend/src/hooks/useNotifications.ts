import { useState, useEffect, useCallback } from 'react';
import type { InAppNotification } from '../types/notification';
import { NotificationService } from '../services/notification.service';
import { useAuth } from './useAuth';

interface UseNotificationsOptions {
  page?: number;
  limit?: number;
  pollIntervalMs?: number;
}

export function useNotifications(options?: UseNotificationsOptions) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(options?.page || 1);
  const [limit] = useState<number>(options?.limit || 10);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(
    async (currentPage = page) => {
      if (!isAuthenticated) return;

      setLoading(true);
      setError(null);

      try {
        const res = await NotificationService.getNotifications({
          page: currentPage,
          limit,
        });
        setNotifications(res.data || []);
        setTotal(res.total || 0);
      } catch (err: any) {
        // Sanitize error message to prevent leaking stack traces or internal secrets
        let userMessage = 'Failed to load notifications. Please try again later.';
        if (err?.message && typeof err.message === 'string') {
          // Exclude raw database / JWT / stack trace errors
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
    [isAuthenticated, page, limit]
  );

  useEffect(() => {
    fetchNotifications(page);
  }, [fetchNotifications, page]);

  // Optional background refresh (default 30 seconds if pollIntervalMs is provided)
  useEffect(() => {
    if (!isAuthenticated || !options?.pollIntervalMs) return;

    const interval = setInterval(() => {
      fetchNotifications(page);
    }, options.pollIntervalMs);

    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotifications, page, options?.pollIntervalMs]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return {
    notifications,
    unreadCount,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    loading,
    error,
    refetch: () => fetchNotifications(page),
    setPage,
  };
}
