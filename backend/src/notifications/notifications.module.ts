import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { AlertSweepModule } from '../alert-sweeps/alert-sweeps.module.js';
import { NotificationsController } from './notifications.controller.js';
import { EmailPreferencesController } from './email-preferences.controller.js';
import { NotificationsService } from './notifications.service.js';
import { WorkflowNotificationService } from './workflow-notification.service.js';
import { CommunicationService } from './communication.service.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { Notification } from './entities/notification.entity.js';
import { NotificationEvent } from './entities/notification-event.entity.js';
import { RoleEmailSetting } from './entities/role-email-setting.entity.js';
import { UserEmailOverride } from './entities/user-email-override.entity.js';
import { EmailSettingAudit } from './entities/email-setting-audit.entity.js';
import { EmailSkipLog } from './entities/email-skip-log.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';

import { NotificationRecipientService } from './notification-recipient.service.js';
import { NotificationsGateway } from './notifications.gateway.js';
import { SystemResetService } from './system-reset.service.js';
import { NotificationPreferenceService } from './notification-preference.service.js';
import { EmailPreferencesService } from './email-preferences.service.js';
import { EmailSkipLogService } from './email-skip-log.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSetting,
      UserNotificationPreference,
      Notification,
      NotificationEvent,
      RoleEmailSetting,
      UserEmailOverride,
      EmailSettingAudit,
      EmailSkipLog,
      User,
      Role,
    ]),
    forwardRef(() => AuthModule),
    forwardRef(() => EmailModule),
    AuditModule,
    forwardRef(() => AlertSweepModule),
  ],
  controllers: [NotificationsController, EmailPreferencesController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    WorkflowNotificationService,
    CommunicationService,
    NotificationRecipientService,
    NotificationPreferenceService,
    EmailPreferencesService,
    EmailSkipLogService,
    SystemResetService,
  ],
  exports: [
    NotificationsGateway,
    NotificationsService,
    WorkflowNotificationService,
    CommunicationService,
    NotificationRecipientService,
    NotificationPreferenceService,
    EmailPreferencesService,
    EmailSkipLogService,
    SystemResetService,
  ],
})
export class NotificationsModule {}
