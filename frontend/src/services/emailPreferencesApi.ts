import { api } from './api';

export type EmailPrefsMode = 'OFF' | 'SHADOW' | 'ON';
export type UserOverrideState = 'INHERIT' | 'ON' | 'OFF';
export type PreferenceSource =
  | 'OVERRIDE_ON'
  | 'OVERRIDE_OFF'
  | 'LEGACY_USER_OFF'
  | 'ROLE_ON'
  | 'ROLE_OFF';

export interface SweepConfigDto {
  eventCode: string;
  label: string;
  category: string;
  enabled: boolean;
  thresholdHours: number;
  defaultHours: number;
  switchKey: string;
  thresholdKey: string;
}

export interface SweepPreviewItemDto {
  id: string;
  referenceNumber: string;
  hoursPending: number;
  details?: Record<string, any>;
}

export interface SweepPreviewResponseDto {
  eventCode: string;
  matchCount: number;
  sample: SweepPreviewItemDto[];
  notYetTimedCount?: number;
  mode: EmailPrefsMode;
}

export interface UpdateSweepResponseDto {
  eventCode: string;
  enabled: boolean;
  thresholdHours: number;
  mode: EmailPrefsMode;
}

export interface ConfigurableEventDto {
  code: string;
  label: string;
  category: string;
}

export interface RoleSummaryDto {
  id: string;
  name: string;
}

export interface RoleMatrixResponseDto {
  mode: EmailPrefsMode;
  roles: RoleSummaryDto[];
  events: ConfigurableEventDto[];
  matrix: Record<string, Record<string, boolean>>; // [roleId]: { [eventCode]: boolean }
}

export interface UpdateRoleEventResponseDto {
  success: boolean;
  roleId: string;
  eventCode: string;
  enabled: boolean;
  mode: EmailPrefsMode;
}

export interface BulkUpdateRoleResponseDto {
  success: boolean;
  roleId: string;
  updatedCount: number;
  mode: EmailPrefsMode;
}

export interface EmailPreferencesUserSummaryDto {
  id: string;
  name: string;
  email: string;
  department?: string;
  role: { id: string; name: string };
  overrideCount: number;
}

export interface UserEventPreferenceItemDto {
  code: string;
  label: string;
  category: string;
  override: UserOverrideState;
  roleEnabled: boolean;
  effective: boolean;
  source: PreferenceSource;
}

export interface UserPreferencesResponseDto {
  mode: EmailPrefsMode;
  user: {
    id: string;
    name: string;
    email: string;
    department?: string;
    role: { id: string; name: string };
    isActive: boolean;
  };
  legacyEmailOff: boolean;
  events: UserEventPreferenceItemDto[];
}

export interface UpdateUserOverrideResponseDto {
  success: boolean;
  userId: string;
  eventCode: string;
  state: UserOverrideState;
  mode: EmailPrefsMode;
}

export interface BulkUpdateUserResponseDto {
  success: boolean;
  userId: string;
  updatedCount: number;
  mode: EmailPrefsMode;
}

export interface EmailSettingAuditEntryDto {
  id: string;
  scope: 'ROLE' | 'USER';
  targetId: string;
  eventCode: string;
  oldValue: string | null;
  newValue: string;
  changedBy: string;
  changedByName: string;
  changedAt: string;
}

export interface AuditLogsResponseDto {
  entries: EmailSettingAuditEntryDto[];
  nextCursor: string | null;
}

export interface GetAuditLogsParams {
  scope?: 'ROLE' | 'USER';
  targetId?: string;
  eventCode?: string;
  limit?: number;
  cursor?: string;
}

export const emailPreferencesApi = {
  /**
   * 1. GET /api/email-preferences/events
   */
  getEvents: (): Promise<ConfigurableEventDto[]> =>
    api.get<ConfigurableEventDto[]>('/api/email-preferences/events'),

  /**
   * 2. GET /api/email-preferences/roles
   */
  getRoleMatrix: (): Promise<RoleMatrixResponseDto> =>
    api.get<RoleMatrixResponseDto>('/api/email-preferences/roles'),

  /**
   * 3. PUT /api/email-preferences/roles/:roleId/events/:eventCode
   */
  updateRoleEvent: (
    roleId: string,
    eventCode: string,
    enabled: boolean,
  ): Promise<UpdateRoleEventResponseDto> =>
    api.put<UpdateRoleEventResponseDto>(
      `/api/email-preferences/roles/${roleId}/events/${eventCode}`,
      { enabled },
    ),

  /**
   * 4. PUT /api/email-preferences/roles/:roleId
   */
  bulkUpdateRoleEvents: (
    roleId: string,
    changes: Array<{ eventCode: string; enabled: boolean }>,
  ): Promise<BulkUpdateRoleResponseDto> =>
    api.put<BulkUpdateRoleResponseDto>(`/api/email-preferences/roles/${roleId}`, {
      changes,
    }),

  /**
   * 5. GET /api/email-preferences/users?roleId=
   */
  getUsers: (roleId?: string): Promise<EmailPreferencesUserSummaryDto[]> => {
    const endpoint = roleId
      ? `/api/email-preferences/users?roleId=${encodeURIComponent(roleId)}`
      : '/api/email-preferences/users';
    return api.get<EmailPreferencesUserSummaryDto[]>(endpoint);
  },

  /**
   * 6. GET /api/email-preferences/users/:userId
   */
  getUserPreferences: (userId: string): Promise<UserPreferencesResponseDto> =>
    api.get<UserPreferencesResponseDto>(`/api/email-preferences/users/${userId}`),

  /**
   * 7. PUT /api/email-preferences/users/:userId/events/:eventCode
   */
  updateUserOverride: (
    userId: string,
    eventCode: string,
    state: UserOverrideState,
  ): Promise<UpdateUserOverrideResponseDto> =>
    api.put<UpdateUserOverrideResponseDto>(
      `/api/email-preferences/users/${userId}/events/${eventCode}`,
      { state },
    ),

  /**
   * 8. PUT /api/email-preferences/users/:userId
   */
  bulkUpdateUserOverrides: (
    userId: string,
    changes: Array<{ eventCode: string; state: UserOverrideState }>,
  ): Promise<BulkUpdateUserResponseDto> =>
    api.put<BulkUpdateUserResponseDto>(`/api/email-preferences/users/${userId}`, {
      changes,
    }),

  /**
   * 9. GET /api/email-preferences/audit
   */
  getAuditLogs: (params: GetAuditLogsParams = {}): Promise<AuditLogsResponseDto> => {
    const q = new URLSearchParams();
    if (params.scope) q.append('scope', params.scope);
    if (params.targetId) q.append('targetId', params.targetId);
    if (params.eventCode) q.append('eventCode', params.eventCode);
    if (params.limit) q.append('limit', String(params.limit));
    if (params.cursor) q.append('cursor', params.cursor);
    const queryStr = q.toString();
    return api.get<AuditLogsResponseDto>(
      `/api/email-preferences/audit${queryStr ? `?${queryStr}` : ''}`,
    );
  },

  /**
   * 10. GET /api/email-preferences/mode
   */
  getMode: (): Promise<{ mode: EmailPrefsMode }> =>
    api.get<{ mode: EmailPrefsMode }>('/api/email-preferences/mode'),

  /**
   * 10. PUT /api/email-preferences/mode
   */
  updateMode: (mode: EmailPrefsMode): Promise<{ success: boolean; mode: EmailPrefsMode }> =>
    api.put<{ success: boolean; mode: EmailPrefsMode }>('/api/email-preferences/mode', {
      mode,
    }),

  /**
   * 11. GET /api/email-preferences/sweeps
   */
  getSweeps: (): Promise<SweepConfigDto[]> =>
    api.get<SweepConfigDto[]>('/api/email-preferences/sweeps'),

  /**
   * 12. PUT /api/email-preferences/sweeps/:eventCode
   */
  updateSweep: (
    eventCode: string,
    enabledOrPayload: boolean | { enabled: boolean; thresholdHours: number },
    thresholdHoursParam?: number,
  ): Promise<UpdateSweepResponseDto> => {
    const body =
      typeof enabledOrPayload === 'object'
        ? enabledOrPayload
        : { enabled: enabledOrPayload, thresholdHours: thresholdHoursParam! };
    return api.put<UpdateSweepResponseDto>(`/api/email-preferences/sweeps/${eventCode}`, body);
  },

  /**
   * 13. GET /api/email-preferences/sweeps/:eventCode/preview
   */
  previewSweep: (eventCode: string): Promise<SweepPreviewResponseDto> =>
    api.get<SweepPreviewResponseDto>(`/api/email-preferences/sweeps/${eventCode}/preview`),
};
