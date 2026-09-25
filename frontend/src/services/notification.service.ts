import { api } from './api';
import type {
  PaginatedNotificationsResponse,
  NotificationsApiResponse,
} from '../types/notification';

export interface GetNotificationsParams {
  page?: number;
  limit?: number;
}

export const NotificationService = {
  /**
   * Fetches notifications for the currently authenticated user.
   * Endpoint: GET /api/notifications
   */
  async getNotifications(
    params?: GetNotificationsParams
  ): Promise<PaginatedNotificationsResponse> {
    const queryParts: string[] = [];
    if (params?.page !== undefined) {
      queryParts.push(`page=${params.page}`);
    }
    if (params?.limit !== undefined) {
      queryParts.push(`limit=${params.limit}`);
    }

    const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    const rawResponse = await api.get<NotificationsApiResponse>(
      `/api/notifications${queryString}`
    );

    // Normalize response structure (Array vs Paginated object)
    if (Array.isArray(rawResponse)) {
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      // Handle client-side pagination slicing if backend returns array
      const total = rawResponse.length;
      const startIndex = (page - 1) * limit;
      const paginatedData = rawResponse.slice(startIndex, startIndex + limit);

      return {
        data: paginatedData,
        total,
        page,
        limit,
      };
    }

    if (rawResponse && typeof rawResponse === 'object' && !Array.isArray(rawResponse)) {
      const itemsList =
        (rawResponse as any).notifications ||
        (rawResponse as any).items ||
        (rawResponse as any).data ||
        [];

      return {
        data: Array.isArray(itemsList) ? itemsList : [],
        total: (rawResponse as any).total ?? (Array.isArray(itemsList) ? itemsList.length : 0),
        page: (rawResponse as any).page ?? params?.page ?? 1,
        limit: (rawResponse as any).limit ?? (rawResponse as any).pageSize ?? params?.limit ?? 10,
      };
    }

    // Fallback empty response
    return {
      data: [],
      total: 0,
      page: params?.page || 1,
      limit: params?.limit || 10,
    };
  },
};
