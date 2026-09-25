import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { Notification } from './entities/notification.entity.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';

export const GLOBAL_WORKFLOW_EMAIL_KEY = 'GLOBAL_WORKFLOW_EMAIL_ENABLED';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(UserNotificationPreference)
    private readonly userPrefRepository: Repository<UserNotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
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
    const val = setting.value as any;
    if (val === false || val === 'false' || val === 'f' || val === 0 || val === '0') {
      return false;
    }
    return true;
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
    const val = pref.workflowEmailEnabled as any;
    if (val === false || val === 'false' || val === 'f' || val === 0 || val === '0') {
      return false;
    }
    return true;
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

  async isSecurityEmailAllowed(userId?: string): Promise<boolean> {
    return this.shouldSendEmail('SECURITY', userId);
  }

  async getUserNotifications(userId: string): Promise<Notification[]> {
    return await this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async getUserNotificationsPaginated(
    userId: string,
    query: GetNotificationsQueryDto = {},
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const rawLimit = Number(query.limit) || 20;
    const limit = Math.min(100, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query.unreadOnly) {
      where.isRead = false;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [items, total] = await this.notificationRepository.findAndCount({
      where,
      order: {
        createdAt: 'DESC',
        id: 'DESC',
      },
      skip,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      notifications: items,
      items,
      total,
      page,
      limit,
      pageSize: limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async markNotificationAsRead(
    userId: string,
    notificationId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found.`,
      );
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException(
        'Cannot modify notification belonging to another user',
      );
    }
    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }
}
