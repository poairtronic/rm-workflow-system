import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailLog } from './entities/email-log.entity.js';
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
  imports: [ConfigModule, AuthModule, TypeOrmModule.forFeature([EmailJob, EmailLog])],
  controllers: [EmailController],
  providers: [
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

        if (providerType === 'test' || (process.env.NODE_ENV === 'test' && providerType !== 'gmail')) {
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
