import { api } from './api';

export interface WorkflowEmailSettingResponse {
  workflowEmailEnabled: boolean;
}

export const NotificationSettingsService = {
  /**
   * Fetches global workflow email setting (ADMIN ONLY).
   */
  async getGlobalSettings(): Promise<WorkflowEmailSettingResponse> {
    return api.get<WorkflowEmailSettingResponse>('/api/notifications/settings');
  },

  /**
   * Updates global workflow email setting (ADMIN ONLY).
   */
  async updateGlobalSettings(workflowEmailEnabled: boolean): Promise<WorkflowEmailSettingResponse> {
    return api.patch<WorkflowEmailSettingResponse>('/api/notifications/settings', {
      workflowEmailEnabled,
    });
  },

  /**
   * Fetches current authenticated user's workflow email preference.
   */
  async getMyPreferences(): Promise<WorkflowEmailSettingResponse> {
    return api.get<WorkflowEmailSettingResponse>('/api/notifications/preferences/me');
  },

  /**
   * Updates current authenticated user's workflow email preference.
   */
  async updateMyPreferences(workflowEmailEnabled: boolean): Promise<WorkflowEmailSettingResponse> {
    return api.patch<WorkflowEmailSettingResponse>('/api/notifications/preferences/me', {
      workflowEmailEnabled,
    });
  },

  /**
   * Updates a specific user's workflow email preference by userId.
   */
  async updateUserPreferencesById(
    userId: string,
    workflowEmailEnabled: boolean,
  ): Promise<WorkflowEmailSettingResponse> {
    return api.patch<WorkflowEmailSettingResponse>(`/api/notifications/preferences/${userId}`, {
      workflowEmailEnabled,
    });
  },
};
