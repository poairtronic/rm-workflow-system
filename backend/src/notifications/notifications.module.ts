import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { WorkflowNotificationService } from './workflow-notification.service.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Role } from '../roles/entities/role.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemSetting,
      UserNotificationPreference,
      User,
      Role,
    ]),
    AuthModule,
    EmailModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, WorkflowNotificationService],
  exports: [NotificationsService, WorkflowNotificationService],
})
export class NotificationsModule {}
