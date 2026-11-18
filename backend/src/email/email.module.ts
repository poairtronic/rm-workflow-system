import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailLog } from './entities/email-log.entity.js';
import { AlertNotificationState } from './entities/alert-notification-state.entity.js';
import { DigestShadowLog } from './entities/digest-shadow-log.entity.js';
import { SystemSetting } from '../notifications/entities/system-setting.entity.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AlertDigestService } from './alert-digest.service.js';
import { EmailQueueService } from './email-queue.service.js';
import { EmailAuditService } from './email-audit.service.js';
import { TemplateResolver } from './resolvers/template.resolver.js';
import { TemplateService } from './template.service.js';
import { TestEmailProvider } from './providers/test-email.provider.js';
import { GmailApiProvider } from './providers/gmail-api.provider.js';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailWorkerService } from './email-worker.service.js';
import { EmailIdempotencyService } from './email-idempotency.service.js';
import { EmailObservabilityService } from './email-observability.service.js';
import { EmailController } from './email.controller.js';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => AuthModule),
    forwardRef(() => NotificationsModule),
    TypeOrmModule.forFeature([EmailJob, EmailLog, AlertNotificationState, DigestShadowLog, SystemSetting, User]),
  ],
  controllers: [EmailController],
  providers: [
    AlertDigestService,
    EmailIdempotencyService,
    EmailObservabilityService,
    TemplateService,
    EmailQueueService,
    EmailAuditService,
    TemplateResolver,
    TestEmailProvider,
    GmailApiProvider,
    {
      provide: EMAIL_PROVIDER,
      useFactory: (
        configService: ConfigService,
        gmailProvider: GmailApiProvider,
        testProvider: TestEmailProvider,
      ) => {
        const providerType = (
          configService.get<string>('EMAIL_PROVIDER_TYPE') ||
          process.env.EMAIL_PROVIDER_TYPE ||
          ''
        ).toLowerCase();

        const nodeEnv = (
          configService.get<string>('NODE_ENV') ||
          process.env.NODE_ENV ||
          'development'
        ).toLowerCase();

        if (providerType === 'test' || (process.env.NODE_ENV === 'test' && providerType !== 'gmail')) {
          return testProvider;
        }

        // Default for non-production: provider type = test (unless explicitly set to gmail)
        if (nodeEnv !== 'production' && providerType !== 'gmail') {
          return testProvider;
        }

        return gmailProvider;
      },
      inject: [ConfigService, GmailApiProvider, TestEmailProvider],
    },
    EmailWorkerService,
  ],
  exports: [
    TypeOrmModule,
    EmailIdempotencyService,
    AlertDigestService,
    EmailObservabilityService,
    TemplateService,
    EmailQueueService,
    EmailAuditService,
    TemplateResolver,
    TestEmailProvider,
    GmailApiProvider,
    EMAIL_PROVIDER,
    EmailWorkerService,
  ],
})
export class EmailModule {}
