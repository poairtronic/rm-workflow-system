export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  targetEntity?: string | null;
  targetId?: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedNotificationsResponse {
  data: InAppNotification[];
  total: number;
  page: number;
  limit: number;
}

export type NotificationsApiResponse = InAppNotification[] | PaginatedNotificationsResponse;

/**
 * Human-readable mapping for notification event types.
 */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  RM_SUBMITTED: 'RM Submitted',
  MATERIAL_ISSUED: 'Material Issued',
  ADDITIONAL_MATERIAL_REQUESTED: 'Additional Material Requested',
  SC_COMPLETED: 'SC Completed',
};

/**
 * Formats raw notification types into human-readable labels.
 */
export function formatNotificationType(type: string): string {
  if (!type) return 'Notification';
  if (NOTIFICATION_TYPE_LABELS[type]) {
    return NOTIFICATION_TYPE_LABELS[type];
  }
  // Convert SCREAMING_SNAKE_CASE or snake_case to Title Case
  return type
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
