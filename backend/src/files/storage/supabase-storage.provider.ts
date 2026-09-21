import { StorageProvider } from './storage-provider.interface.js';
import { ConfigService } from '@nestjs/config';
import 'multer';

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '';
    this.bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET') || 'documents';
  }

  async upload(
    file: Buffer | Express.Multer.File,
    storageKey: string,
    mimeType: string,
  ): Promise<string> {
    if (!this.supabaseUrl || !this.supabaseKey) {
      throw new Error('Supabase configuration missing');
    }
    // We would use the supabase-js SDK here to upload the file to Supabase.
    // Since Phase 14.1 doesn't connect to production Supabase, we throw an error if called.
    throw new Error('SupabaseStorageProvider is not yet connected to a live project.');
  }

  async delete(storageKey: string): Promise<void> {
    throw new Error('SupabaseStorageProvider is not yet connected to a live project.');
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    throw new Error('SupabaseStorageProvider is not yet connected to a live project.');
  }
}
