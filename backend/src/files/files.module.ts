import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module.js';
import { AttachmentsModule } from '../attachments/attachments.module.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { UploadedFile } from './entities/uploaded-file.entity.js';
import { LocalStorageProvider } from './storage/local-storage.provider.js';
import { SupabaseStorageProvider } from './storage/supabase-storage.provider.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UploadedFile]),
    ConfigModule,
    AuthModule,
    forwardRef(() => AttachmentsModule),
  ],
  controllers: [FilesController],
  providers: [
    FilesService,
    {
      provide: 'STORAGE_PROVIDER',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction =
          configService.get<string>('NODE_ENV') === 'production';
        const providerConfig = configService
          .get<string>('STORAGE_PROVIDER')
          ?.toUpperCase();
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseKey =
          configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
          configService.get<string>('SUPABASE_SERVICE_KEY');

        if (isProduction) {
          if (!supabaseUrl || !supabaseKey) {
            throw new Error(
              'Production configuration failure: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in production.',
            );
          }
          return new SupabaseStorageProvider(configService);
        }

        if (
          providerConfig === 'SUPABASE' ||
          (supabaseUrl && supabaseUrl.trim() !== '')
        ) {
          return new SupabaseStorageProvider(configService);
        }

        return new LocalStorageProvider();
      },
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
