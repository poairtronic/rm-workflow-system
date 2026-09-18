import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ALL_ENTITIES } from './config/data-source.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { RolesModule } from './roles/roles.module.js';
import { PermissionsModule } from './permissions/permissions.module.js';
import { CustomersModule } from './customers/customers.module.js';
import { PoModule } from './po/po.module.js';
import { ScModule } from './sc/sc.module.js';
import { RmModule } from './rm/rm.module.js';
import { StoresModule } from './stores/stores.module.js';
import { MaterialIssueModule } from './material-issue/material-issue.module.js';
import { ProductionModule } from './production/production.module.js';
import { MaterialMovementModule } from './material-movement/material-movement.module.js';
import { AdditionalRequestModule } from './additional-request/additional-request.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AuditModule } from './audit/audit.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MasterDataModule } from './master-data/master-data.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl =
          configService.get<string>('DATABASE_URL') ||
          process.env.DATABASE_URL ||
          'postgresql://postgres:postgres@localhost:5432/rm_workflow_db';
        const isSsl =
          dbUrl.includes('sslmode=require') ||
          configService.get<string>('NODE_ENV') === 'production';

        return {
          type: 'postgres',
          url: dbUrl,
          entities: ALL_ENTITIES,
          autoLoadEntities: true,
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          retryAttempts: 2,
          retryDelay: 3000,
        };
      },
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    CustomersModule,
    PoModule,
    ScModule,
    RmModule,
    StoresModule,
    MaterialIssueModule,
    ProductionModule,
    MaterialMovementModule,
    AdditionalRequestModule,
    NotificationsModule,
    AnalyticsModule,
    AuditModule,
    InventoryModule,
    MasterDataModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
