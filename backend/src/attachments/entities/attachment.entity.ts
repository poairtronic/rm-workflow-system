import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UploadedFile } from '../../files/entities/uploaded-file.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum AttachmentContext {
  PO = 'PO',
  SC = 'SC',
  RM_REQUEST = 'RM_REQUEST',
  PRODUCTION = 'PRODUCTION',
  ADDITIONAL_MATERIAL_REQUEST = 'ADDITIONAL_MATERIAL_REQUEST',
}

@Entity('attachments')
@Index('IDX_ATTACHMENTS_UNIQUE_ACTIVE', ['fileId', 'context', 'recordId'], { unique: true, where: 'is_active = true' })
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => UploadedFile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'file_id' })
  file!: UploadedFile;

  @Column({ type: 'varchar', length: 50 })
  context!: AttachmentContext;

  @Index()
  @Column({ name: 'record_id', type: 'uuid' })
  recordId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
