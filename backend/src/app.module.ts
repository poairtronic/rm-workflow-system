import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';

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
          autoLoadEntities: true,
          synchronize: configService.get<string>('NODE_ENV') !== 'production',
          ssl: isSsl ? { rejectUnauthorized: false } : false,
          retryAttempts: 2,
          retryDelay: 3000,
        };
      },
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
