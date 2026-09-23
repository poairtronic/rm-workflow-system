import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { SystemSetting } from './entities/system-setting.entity.js';
import { UserNotificationPreference } from './entities/user-notification-preference.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemSetting, UserNotificationPreference]),
    AuthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
