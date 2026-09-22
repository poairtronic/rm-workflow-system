import { StorageProvider } from './storage-provider.interface.js';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'multer';

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private supabaseKey: string;
  private bucket: string;
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.get<string>('SUPABASE_URL') || '';
    this.supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_KEY') ||
      '';
    this.bucket =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET') ||
      'rmrit-documents';

    if (this.supabaseUrl && this.supabaseKey) {
      this.client = createClient(this.supabaseUrl, this.supabaseKey, {
        auth: { persistSession: false },
      });
    }
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase client configuration missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
      );
    }
    return this.client;
  }

  async upload(
    file: Buffer | Express.Multer.File,
    storageKey: string,
    mimeType: string,
  ): Promise<string> {
    const client = this.getClient();
    const buffer = Buffer.isBuffer(file) ? file : file.buffer;

    if (!buffer) {
      throw new Error('Invalid file payload: file buffer is missing or empty.');
    }

    const { data, error } = await client.storage
      .from(this.bucket)
      .upload(storageKey, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`Supabase upload error for ${storageKey}:`, error);
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }

    return data?.path || storageKey;
  }

  async delete(storageKey: string): Promise<void> {
    const client = this.getClient();
    const { error } = await client.storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      console.error(`Supabase delete error for ${storageKey}:`, error);
      throw new Error(`Supabase Storage delete failed: ${error.message}`);
    }
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    const client = this.getClient();
    const expiresInSeconds = 15 * 60; // 15 minutes signed link expiry

    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(storageKey, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.error(
        `Supabase signed URL error for ${storageKey}:`,
        error || 'No signed URL returned',
      );
      throw new Error(
        `Supabase Storage getDownloadUrl failed: ${error?.message || 'Unknown error'}`,
      );
    }

    return data.signedUrl;
  }
}
