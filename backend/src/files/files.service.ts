import { Injectable, Inject, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UploadedFile } from './entities/uploaded-file.entity.js';
import { StorageProvider } from './storage/storage-provider.interface.js';
import { v4 as uuidv4 } from 'uuid';
import 'multer';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(UploadedFile)
    private readonly uploadedFileRepository: Repository<UploadedFile>,
    @Inject('STORAGE_PROVIDER')
    private readonly storageProvider: any, // use any here to bypass emitDecoratorMetadata interface error
  ) {}

  async uploadFile(
    userId: string,
    file: Express.Multer.File,
  ): Promise<UploadedFile> {
    const fileId = uuidv4();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `files/${userId}/${fileId}_${safeName}`;

    let uploadSuccessful = false;
    let url = '';

    // 1. Upload to storage
    try {
      url = await this.storageProvider.upload(
        file.buffer,
        storageKey,
        file.mimetype,
      );
      uploadSuccessful = true;
    } catch (error: any) {
      console.error('Storage upload error:', error);
      throw new InternalServerErrorException('Failed to upload file to storage provider');
    }

    // 2. Save metadata to DB
    try {
      const uploadedFile = this.uploadedFileRepository.create({
        id: fileId,
        originalName: file.originalname,
        storageKey: storageKey,
        mimeType: file.mimetype,
        size: file.size,
        provider: this.storageProvider.constructor.name === 'SupabaseStorageProvider' ? 'SUPABASE' : 'LOCAL',
        createdById: userId,
      });

      return await this.uploadedFileRepository.save(uploadedFile);
    } catch (error: any) {
      // 3. Compensation / Rollback
      if (uploadSuccessful) {
        try {
          await this.storageProvider.delete(storageKey);
        } catch (cleanupError) {
          // Log the orphan file here in a real scenario
          console.error(`Failed to clean up storage object ${storageKey} after DB error:`, cleanupError);
        }
      }
      console.error('DB save error:', error);
      throw new InternalServerErrorException('Failed to save file metadata');
    }
  }

  async getFileMetadata(fileId: string): Promise<UploadedFile> {
    const file = await this.uploadedFileRepository.findOne({
      where: { id: fileId, isActive: true },
    });
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found or removed`);
    }
    return file;
  }

  async getFileDownloadUrl(fileId: string): Promise<string> {
    const file = await this.getFileMetadata(fileId);
    return await this.storageProvider.getDownloadUrl(file.storageKey);
  }

  async removeFile(userId: string, fileId: string): Promise<void> {
    const file = await this.uploadedFileRepository.findOne({
      where: { id: fileId, isActive: true },
    });
    
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found or already removed`);
    }

    // Soft delete metadata
    file.isActive = false;
    file.removedById = userId;
    file.removedAt = new Date();
    await this.uploadedFileRepository.save(file);

    // Optionally attempt to remove from physical storage
    try {
      await this.storageProvider.delete(file.storageKey);
    } catch (error) {
      console.error(`Failed to physically delete file ${file.storageKey} from storage`, error);
    }
  }
}
