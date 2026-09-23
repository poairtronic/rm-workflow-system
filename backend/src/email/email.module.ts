import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailQueueService } from './email-queue.service.js';
import { TemplateResolver } from './resolvers/template.resolver.js';
import { TestEmailProvider } from './providers/test-email.provider.js';
import { GmailApiProvider } from './providers/gmail-api.provider.js';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface.js';
import { EmailWorkerService } from './email-worker.service.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailJob])],
  providers: [
    EmailQueueService,
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
    EmailQueueService,
    TemplateResolver,
    TestEmailProvider,
    GmailApiProvider,
    EMAIL_PROVIDER,
    EmailWorkerService,
  ],
})
export class EmailModule {}
