import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import 'multer';

import { ConsumableLineAttachment } from './entities/consumable-line-attachment.entity.js';
import {
  ConsumableRequestItem,
  ConsumableApprovalStatus,
} from './entities/consumable-request-item.entity.js';

const BUCKET_NAME = 'consumable-attachments';
const MAX_STORED_BYTES = 1024 * 1024; // 1 MB
const MAX_ATTACHMENTS_PER_LINE = 3;
const SIGNED_URL_EXPIRY_SECONDS = 180; // 3 minutes (within 60s-5min requirement)

const ALLOWED_MIME_TYPES = new Set([
  'image/webp',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function mimeToExt(mime: string): string {
  switch (mime) {
    case 'image/webp':
      return 'webp';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
    case 'image/heif':
      return 'heic';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'bin';
  }
}

export interface AttachmentDto {
  id: string;
  lineItemId: string;
  fileName: string;
  mimeType: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  uploadedBy: string | null;
  createdAt: Date;
  signedUrl: string;
}

@Injectable()
export class ConsumableAttachmentsService {
  private readonly logger = new Logger(ConsumableAttachmentsService.name);
  private supabaseClient: SupabaseClient | null = null;
  private bucketVerified = false;
  private readonly localFallbackDir = path.resolve(
    process.cwd(),
    'uploads',
    'consumable-attachments',
  );

  constructor(
    @InjectRepository(ConsumableLineAttachment)
    private readonly attachmentRepo: Repository<ConsumableLineAttachment>,
    @InjectRepository(ConsumableRequestItem)
    private readonly itemRepo: Repository<ConsumableRequestItem>,
    @Optional()
    private readonly configService?: ConfigService,
  ) {
    const url =
      this.configService?.get<string>('SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      '';
    const key =
      this.configService?.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService?.get<string>('SUPABASE_SERVICE_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      '';

    if (url && key) {
      this.supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
    } else if (process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured for consumable-attachments.',
      );
    }
  }

  private async ensureBucketExists(): Promise<void> {
    if (!this.supabaseClient || this.bucketVerified) return;
    try {
      const { error: getErr } = await this.supabaseClient.storage.getBucket(BUCKET_NAME);
      if (!getErr) {
        this.bucketVerified = true;
        return;
      }
      const { error: createErr } = await this.supabaseClient.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 2 * 1024 * 1024,
        allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
      });
      if (createErr && !createErr.message?.toLowerCase().includes('already exists')) {
        this.logger.warn(`Could not auto-create bucket ${BUCKET_NAME}: ${createErr.message}`);
      } else {
        this.bucketVerified = true;
      }
    } catch (err: any) {
      this.logger.warn(`Bucket verification warning for ${BUCKET_NAME}: ${err?.message || err}`);
    }
  }

  private async uploadToStorage(
    filePath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<void> {
    if (this.supabaseClient) {
      await this.ensureBucketExists();
      const { error } = await this.supabaseClient.storage
        .from(BUCKET_NAME)
        .upload(filePath, buffer, {
          contentType: mimeType,
          upsert: false,
        });
      if (error) {
        this.logger.error(`Supabase upload failed for ${filePath}: ${error.message}`);
        throw new InternalServerErrorException(
          `Failed to upload attachment to storage: ${error.message}`,
        );
      }
      return;
    }

    // Non-production local disk fallback
    const fullPath = path.join(this.localFallbackDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  private async deleteFromStorage(filePaths: string[]): Promise<void> {
    if (filePaths.length === 0) return;

    if (this.supabaseClient) {
      const { error } = await this.supabaseClient.storage
        .from(BUCKET_NAME)
        .remove(filePaths);
      if (error) {
        this.logger.warn(
          `Supabase storage cleanup warning for [${filePaths.join(', ')}]: ${error.message}`,
        );
      }
      return;
    }

    for (const fp of filePaths) {
      try {
        await fs.unlink(path.join(this.localFallbackDir, fp));
      } catch {
        // Ignore missing local files
      }
    }
  }

  private async createSignedUrl(
    attachment: ConsumableLineAttachment,
  ): Promise<string> {
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.storage
        .from(BUCKET_NAME)
        .createSignedUrl(attachment.filePath, SIGNED_URL_EXPIRY_SECONDS);
      if (error || !data?.signedUrl) {
        this.logger.error(
          `Failed to create signed URL for ${attachment.filePath}: ${error?.message || 'Unknown error'}`,
        );
        throw new InternalServerErrorException(
          'Failed to generate signed download URL for attachment.',
        );
      }
      return data.signedUrl;
    }

    return `/api/consumables/attachments/${attachment.id}/raw`;
  }

  async getLocalFileBuffer(
    attachmentId: string,
  ): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment "${attachmentId}" not found.`);
    }
    const fullPath = path.join(this.localFallbackDir, attachment.filePath);
    const buffer = await fs.readFile(fullPath);
    return {
      buffer,
      mimeType: attachment.mimeType,
      fileName: attachment.fileName,
    };
  }

  async uploadAttachment(
    lineId: string,
    file: Express.Multer.File,
    originalSizeBytes: number,
    userId: string,
  ): Promise<AttachmentDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Attachment file is required.');
    }

    const rawMime = (file.mimetype || '').toLowerCase().trim();
    const mimeType = rawMime === 'image/jpg' ? 'image/jpeg' : rawMime;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: jpg, png, webp, heic, pdf.`,
      );
    }

    const storedSizeBytes = file.size || file.buffer.length;
    if (storedSizeBytes > MAX_STORED_BYTES) {
      throw new BadRequestException(
        `Compressed file exceeds 1 MB limit (${storedSizeBytes} bytes).`,
      );
    }

    const lineItem = await this.itemRepo.findOne({ where: { id: lineId } });
    if (!lineItem) {
      throw new NotFoundException(`Consumable line item "${lineId}" not found.`);
    }

    const existingCount = await this.attachmentRepo.count({
      where: { lineItemId: lineId },
    });
    if (existingCount >= MAX_ATTACHMENTS_PER_LINE) {
      throw new BadRequestException(
        `Maximum ${MAX_ATTACHMENTS_PER_LINE} attachments allowed per line item.`,
      );
    }

    const ext = mimeToExt(mimeType);
    const filePath = `${lineId}/${uuidv4()}.${ext}`;
    const safeFileName = (file.originalname || `attachment.${ext}`).slice(0, 255);
    const origBytes =
      Number.isFinite(originalSizeBytes) && originalSizeBytes > 0
        ? Math.round(originalSizeBytes)
        : storedSizeBytes;

    await this.uploadToStorage(filePath, file.buffer, mimeType);

    try {
      const entity = this.attachmentRepo.create({
        lineItemId: lineId,
        filePath,
        fileName: safeFileName,
        mimeType,
        originalSizeBytes: origBytes,
        storedSizeBytes,
        uploadedBy: userId || null,
      });
      const saved = await this.attachmentRepo.save(entity);
      const signedUrl = await this.createSignedUrl(saved);

      return {
        id: saved.id,
        lineItemId: saved.lineItemId,
        fileName: saved.fileName,
        mimeType: saved.mimeType,
        originalSizeBytes: saved.originalSizeBytes,
        storedSizeBytes: saved.storedSizeBytes,
        uploadedBy: saved.uploadedBy ?? null,
        createdAt: saved.createdAt,
        signedUrl,
      };
    } catch (err) {
      await this.deleteFromStorage([filePath]);
      throw err;
    }
  }

  async getAttachmentsForLine(lineId: string): Promise<AttachmentDto[]> {
    const lineItem = await this.itemRepo.findOne({ where: { id: lineId } });
    if (!lineItem) {
      throw new NotFoundException(`Consumable line item "${lineId}" not found.`);
    }

    const rows = await this.attachmentRepo.find({
      where: { lineItemId: lineId },
      order: { createdAt: 'ASC' },
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        lineItemId: row.lineItemId,
        fileName: row.fileName,
        mimeType: row.mimeType,
        originalSizeBytes: row.originalSizeBytes,
        storedSizeBytes: row.storedSizeBytes,
        uploadedBy: row.uploadedBy ?? null,
        createdAt: row.createdAt,
        signedUrl: await this.createSignedUrl(row),
      })),
    );
  }

  async deleteAttachment(
    attachmentId: string,
    userId: string,
    userRole?: string,
  ): Promise<{ success: boolean; deletedId: string }> {
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId },
      relations: { lineItem: true },
    });
    if (!attachment) {
      throw new NotFoundException(`Attachment "${attachmentId}" not found.`);
    }

    const approvalStatus = attachment.lineItem?.approvalStatus ?? null;
    if (
      approvalStatus !== null &&
      approvalStatus !== ConsumableApprovalStatus.PENDING_SM_APPROVAL
    ) {
      throw new BadRequestException(
        'Cannot delete attachment after SM approval or rejection.',
      );
    }

    const isAdmin = (userRole || '').toUpperCase() === 'ADMIN';
    if (!isAdmin && attachment.uploadedBy !== userId) {
      throw new ForbiddenException(
        'Only the uploader or an Admin can delete this attachment.',
      );
    }

    await this.deleteFromStorage([attachment.filePath]);
    await this.attachmentRepo.delete({ id: attachment.id });

    return { success: true, deletedId: attachment.id };
  }

  async getAttachmentCountsByLineIds(
    lineIds: string[],
  ): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (!lineIds || lineIds.length === 0) return counts;

    const rows = await this.attachmentRepo
      .createQueryBuilder('att')
      .select('att.line_item_id', 'lineItemId')
      .addSelect('COUNT(*)::int', 'count')
      .where('att.line_item_id IN (:...lineIds)', { lineIds })
      .groupBy('att.line_item_id')
      .getRawMany<{ lineItemId: string; count: number | string }>();

    for (const r of rows) {
      counts.set(r.lineItemId, Number(r.count) || 0);
    }
    return counts;
  }

  async getStoragePathsForLineItems(lineIds: string[]): Promise<string[]> {
    if (!lineIds || lineIds.length === 0) return [];
    const rows = await this.attachmentRepo.find({
      where: { lineItemId: In(lineIds) },
      select: { filePath: true },
    });
    return rows.map((r) => r.filePath).filter(Boolean);
  }

  async cleanupStoragePaths(filePaths: string[]): Promise<void> {
    await this.deleteFromStorage(filePaths);
  }
}
