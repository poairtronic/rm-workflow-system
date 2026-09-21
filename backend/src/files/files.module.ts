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
        // If SUPABASE_URL exists, use Supabase provider, else fallback to local
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        if (supabaseUrl && supabaseUrl.trim() !== '') {
          return new SupabaseStorageProvider(configService);
        }
        return new LocalStorageProvider();
      },
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
