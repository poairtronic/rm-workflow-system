import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ConsumableRequestItem } from './consumable-request-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('consumable_line_attachments')
export class ConsumableLineAttachment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('idx_cla_line_item_id')
  @Column({ name: 'line_item_id', type: 'uuid' })
  lineItemId!: string;

  @ManyToOne(() => ConsumableRequestItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'line_item_id' })
  lineItem!: ConsumableRequestItem;

  @Column({ name: 'file_path', type: 'text' })
  filePath!: string;

  @Column({ name: 'file_name', type: 'text' })
  fileName!: string;

  @Column({ name: 'mime_type', type: 'text' })
  mimeType!: string;

  @Column({ name: 'original_size_bytes', type: 'int' })
  originalSizeBytes!: number;

  @Column({ name: 'stored_size_bytes', type: 'int' })
  storedSizeBytes!: number;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploaded_by' })
  uploadedByUser?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
