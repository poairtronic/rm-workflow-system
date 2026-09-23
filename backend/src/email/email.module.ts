import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EmailJob } from './entities/email-job.entity.js';
import { EmailQueueService } from './email-queue.service.js';
import { TemplateResolver } from './resolvers/template.resolver.js';
import { TestEmailProvider } from './providers/test-email.provider.js';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface.js';
import { EmailWorkerService } from './email-worker.service.js';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailJob])],
  providers: [
    EmailQueueService,
    TemplateResolver,
    TestEmailProvider,
    {
      provide: EMAIL_PROVIDER,
      useExisting: TestEmailProvider,
    },
    EmailWorkerService,
  ],
  exports: [
    TypeOrmModule,
    EmailQueueService,
    TemplateResolver,
    TestEmailProvider,
    EMAIL_PROVIDER,
    EmailWorkerService,
  ],
})
export class EmailModule {}
