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
import { User } from '../../users/entities/user.entity.js';

@Entity('uploaded_files')
export class UploadedFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'original_name', length: 255 })
  originalName!: string;

  @Index()
  @Column({ name: 'storage_key', length: 255, unique: true })
  storageKey!: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType!: string;

  @Column({ type: 'numeric', precision: 12, scale: 0 })
  size!: number;

  @Column({ length: 50 })
  provider!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by_id' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @Column({ name: 'removed_by_id', nullable: true })
  removedById?: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'removed_by_id' })
  removedBy?: User;

  @Column({ name: 'removed_at', type: 'timestamp', nullable: true })
  removedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
