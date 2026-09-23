import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';

export const GLOBAL_WORKFLOW_EMAIL_KEY = 'GLOBAL_WORKFLOW_EMAIL_ENABLED';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(UserNotificationPreference)
    private readonly userPrefRepository: Repository<UserNotificationPreference>,
  ) {}

  getStatus() {
    return { module: 'notifications', status: 'ready' };
  }

  async getGlobalWorkflowEmailEnabled(): Promise<boolean> {
    const setting = await this.systemSettingRepository.findOne({
      where: { key: GLOBAL_WORKFLOW_EMAIL_KEY },
    });
    if (!setting) {
      return true;
    }
    return setting.value !== 'false';
  }

  async setGlobalWorkflowEmailEnabled(
    enabled: boolean,
    updatedBy?: string,
  ): Promise<boolean> {
    let setting = await this.systemSettingRepository.findOne({
      where: { key: GLOBAL_WORKFLOW_EMAIL_KEY },
    });
    if (!setting) {
      setting = this.systemSettingRepository.create({
        key: GLOBAL_WORKFLOW_EMAIL_KEY,
        value: String(enabled),
        updatedBy,
      });
    } else {
      setting.value = String(enabled);
      if (updatedBy) {
        setting.updatedBy = updatedBy;
      }
    }
    await this.systemSettingRepository.save(setting);
    return enabled;
  }

  async getUserWorkflowEmailEnabled(userId: string): Promise<boolean> {
    if (!userId) {
      return true;
    }
    const pref = await this.userPrefRepository.findOne({
      where: { userId },
    });
    if (!pref) {
      return true;
    }
    return pref.workflowEmailEnabled;
  }

  async setUserWorkflowEmailEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<UserNotificationPreference> {
    let pref = await this.userPrefRepository.findOne({
      where: { userId },
    });
    if (!pref) {
      pref = this.userPrefRepository.create({
        userId,
        workflowEmailEnabled: enabled,
      });
    } else {
      pref.workflowEmailEnabled = enabled;
    }
    return await this.userPrefRepository.save(pref);
  }

  async isWorkflowEmailAllowed(userId?: string): Promise<boolean> {
    const globalEnabled = await this.getGlobalWorkflowEmailEnabled();
    if (!globalEnabled) {
      return false;
    }
    if (!userId) {
      return true;
    }
    const userEnabled = await this.getUserWorkflowEmailEnabled(userId);
    return globalEnabled && userEnabled;
  }

  async shouldSendEmail(
    category: 'SECURITY' | 'WORKFLOW' | string,
    userId?: string,
  ): Promise<boolean> {
    if (category.toUpperCase() === 'SECURITY') {
      return true;
    }
    return this.isWorkflowEmailAllowed(userId);
  }
}
