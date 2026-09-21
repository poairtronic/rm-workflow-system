import { StorageProvider } from './storage-provider.interface.js';
import * as fs from 'fs';
import * as path from 'path';
import 'multer';

export class LocalStorageProvider implements StorageProvider {
  private readonly storagePath: string;

  constructor() {
    this.storagePath = path.join(process.cwd(), '.storage');
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  async upload(
    file: Buffer | Express.Multer.File,
    storageKey: string,
    mimeType: string,
  ): Promise<string> {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    const filePath = path.join(this.storagePath, storageKey.replace(/\//g, '_'));
    const buffer = Buffer.isBuffer(file) ? file : (file as any).buffer;
    
    await fs.promises.writeFile(filePath, buffer);
    
    // In local dev, we just return a local path or mock URL
    return `/files/local/${storageKey.replace(/\//g, '_')}`;
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(this.storagePath, storageKey.replace(/\//g, '_'));
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async getDownloadUrl(storageKey: string): Promise<string> {
    return `/files/local/${storageKey.replace(/\//g, '_')}`;
  }
}
