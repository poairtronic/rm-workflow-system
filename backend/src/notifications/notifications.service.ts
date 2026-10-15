import { Injectable, NotFoundException, ForbiddenException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { Notification } from './entities/notification.entity.js';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto.js';
import { NotificationsGateway } from './notifications.gateway.js';

import { AuditService } from '../audit/audit.service.js';

export const GLOBAL_WORKFLOW_EMAIL_KEY = 'GLOBAL_WORKFLOW_EMAIL_ENABLED';

export interface SystemConfigPayload {
  appearance?: {
    theme?: string;
    density?: string;
  };
  notifications?: {
    globalEmailEnabled?: boolean;
    workflowAlertsEnabled?: boolean;
    dcOverdueAlertsEnabled?: boolean;
    materialIssueOverdueAlertsEnabled?: boolean;
    lowStockMslAlertsEnabled?: boolean;
    stockMovementAlertsEnabled?: boolean;
  };
  regional?: {
    timezone?: string;
    dateFormat?: string;
    defaultStockUnit?: string;
    currency?: string;
  };
  thresholds?: {
    dcReturnSlaDays?: number;
    materialIssueOverdueHours?: number;
    mslCheckIntervalHours?: number;
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(UserNotificationPreference)
    private readonly userPrefRepository: Repository<UserNotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly auditService: AuditService,
    @Optional() private readonly notificationsGateway?: NotificationsGateway,
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

    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    } else if (query.unreadOnly) {
      where.isRead = false;
    } else if (query.readOnly) {
      where.isRead = true;
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

    const unreadCount = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });

    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    return {
      notifications: items,
      items,
      total,
      unreadCount,
      page,
      limit,
      pageSize: limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    if (!userId) return 0;
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean; count: number; updatedCount: number }> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    const count = result.affected || 0;
    if (this.notificationsGateway) {
      try {
        this.notificationsGateway.sendUnreadCountToUser(userId, 0);
      } catch {
        // Non-blocking socket emission
      }
    }
    return { success: true, count, updatedCount: count };
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
    const saved = await this.notificationRepository.save(notification);
    if (this.notificationsGateway) {
      try {
        const unreadCount = await this.getUnreadCount(userId);
        this.notificationsGateway.sendUnreadCountToUser(userId, unreadCount);
      } catch {
        // Non-blocking socket emission
      }
    }
    return saved;
  }

  /**
   * Retrieves full system configuration with defaults
   */
  async getSystemConfig(): Promise<Required<SystemConfigPayload>> {
    const settings = await this.systemSettingRepository.find();
    const map = new Map<string, string>();
    for (const s of settings) {
      map.set(s.key, s.value);
    }

    const parseBool = (key: string, def: boolean): boolean => {
      if (!map.has(key)) return def;
      const v = map.get(key);
      return v === 'true' || v === '1';
    };

    const parseIntVal = (key: string, def: number): number => {
      if (!map.has(key)) return def;
      const parsed = parseInt(map.get(key)!, 10);
      return isNaN(parsed) ? def : parsed;
    };

    return {
      appearance: {
        theme: map.get('APP_THEME') || 'Enterprise Light',
        density: map.get('APP_DATA_DENSITY') || 'Compact',
      },
      notifications: {
        globalEmailEnabled: parseBool(GLOBAL_WORKFLOW_EMAIL_KEY, true),
        workflowAlertsEnabled: parseBool('WORKFLOW_ALERTS_ENABLED', true),
        dcOverdueAlertsEnabled: parseBool('DC_OVERDUE_ALERTS_ENABLED', true),
        materialIssueOverdueAlertsEnabled: parseBool('MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED', true),
        lowStockMslAlertsEnabled: parseBool('LOW_STOCK_MSL_ALERTS_ENABLED', true),
        stockMovementAlertsEnabled: parseBool('STOCK_MOVEMENT_ALERTS_ENABLED', true),
      },
      regional: {
        timezone: map.get('APP_TIMEZONE') || 'Asia/Kolkata (IST)',
        dateFormat: map.get('APP_DATE_FORMAT') || 'DD MMM YYYY',
        defaultStockUnit: map.get('DEFAULT_STOCK_UNIT') || 'Meters',
      },
      thresholds: {
        dcReturnSlaDays: parseIntVal('DC_RETURN_SLA_DAYS', 7),
        materialIssueOverdueHours: parseIntVal('MATERIAL_ISSUE_OVERDUE_HOURS', 48),
        mslCheckIntervalHours: parseIntVal('MSL_CHECK_INTERVAL_HOURS', 24),
      },
    };
  }

  /**
   * Updates system configuration, saves to system_settings, and records an audit log
   */
  async updateSystemConfig(
    payload: SystemConfigPayload,
    actorId?: string,
  ): Promise<Required<SystemConfigPayload>> {
    const toSave: Record<string, string> = {};

    if (payload.appearance) {
      if (payload.appearance.theme) toSave['APP_THEME'] = payload.appearance.theme;
      if (payload.appearance.density) toSave['APP_DATA_DENSITY'] = payload.appearance.density;
    }

    if (payload.notifications) {
      if (typeof payload.notifications.globalEmailEnabled === 'boolean') {
        toSave[GLOBAL_WORKFLOW_EMAIL_KEY] = String(payload.notifications.globalEmailEnabled);
      }
      if (typeof payload.notifications.workflowAlertsEnabled === 'boolean') {
        toSave['WORKFLOW_ALERTS_ENABLED'] = String(payload.notifications.workflowAlertsEnabled);
      }
      if (typeof payload.notifications.dcOverdueAlertsEnabled === 'boolean') {
        toSave['DC_OVERDUE_ALERTS_ENABLED'] = String(payload.notifications.dcOverdueAlertsEnabled);
      }
      if (typeof payload.notifications.materialIssueOverdueAlertsEnabled === 'boolean') {
        toSave['MATERIAL_ISSUE_OVERDUE_ALERTS_ENABLED'] = String(payload.notifications.materialIssueOverdueAlertsEnabled);
      }
      if (typeof payload.notifications.lowStockMslAlertsEnabled === 'boolean') {
        toSave['LOW_STOCK_MSL_ALERTS_ENABLED'] = String(payload.notifications.lowStockMslAlertsEnabled);
      }
      if (typeof payload.notifications.stockMovementAlertsEnabled === 'boolean') {
        toSave['STOCK_MOVEMENT_ALERTS_ENABLED'] = String(payload.notifications.stockMovementAlertsEnabled);
      }
    }

    if (payload.regional) {
      if (payload.regional.timezone) toSave['APP_TIMEZONE'] = payload.regional.timezone;
      if (payload.regional.dateFormat) toSave['APP_DATE_FORMAT'] = payload.regional.dateFormat;
      if (payload.regional.defaultStockUnit) toSave['DEFAULT_STOCK_UNIT'] = payload.regional.defaultStockUnit;
    }

    if (payload.thresholds) {
      if (typeof payload.thresholds.dcReturnSlaDays === 'number') {
        toSave['DC_RETURN_SLA_DAYS'] = String(payload.thresholds.dcReturnSlaDays);
      }
      if (typeof payload.thresholds.materialIssueOverdueHours === 'number') {
        toSave['MATERIAL_ISSUE_OVERDUE_HOURS'] = String(payload.thresholds.materialIssueOverdueHours);
      }
      if (typeof payload.thresholds.mslCheckIntervalHours === 'number') {
        toSave['MSL_CHECK_INTERVAL_HOURS'] = String(payload.thresholds.mslCheckIntervalHours);
      }
    }

    for (const [key, value] of Object.entries(toSave)) {
      let setting = await this.systemSettingRepository.findOne({ where: { key } });
      if (!setting) {
        setting = this.systemSettingRepository.create({
          key,
          value,
          updatedBy: actorId || 'ADMIN',
        });
      } else {
        setting.value = value;
        if (actorId) setting.updatedBy = actorId;
      }
      await this.systemSettingRepository.save(setting);
    }

    // Record audit event
    try {
      await this.auditService.logEvent({
        entityName: 'ApplicationSetting',
        entityId: 'GlobalSystemConfiguration',
        actionType: 'UPDATE',
        actorId,
        newValues: toSave,
        metadata: { updatedKeys: Object.keys(toSave) },
      });
    } catch {
      // Non-blocking audit error
    }

    return await this.getSystemConfig();
  }
}
