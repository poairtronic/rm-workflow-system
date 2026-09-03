import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RmItem } from './rm-item.entity.js';
import { RmRequest } from './rm-request.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum SnapshotChangeType {
  ORIGINAL_SUBMISSION = 'ORIGINAL_SUBMISSION',
  DESIGNER_REVISION = 'DESIGNER_REVISION',
}

@Entity('rm_item_snapshots')
export class RmItemSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Index()
  @Column({ name: 'rm_form_id' })
  rmFormId!: string;

  @ManyToOne(() => RmRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rm_form_id' })
  rmRequest!: RmRequest;

  @Column({ name: 'revision_number', type: 'int', default: 1 })
  revisionNumber!: number;

  @Column({
    name: 'change_type',
    type: 'varchar',
    length: 50,
    default: SnapshotChangeType.ORIGINAL_SUBMISSION,
  })
  changeType!: SnapshotChangeType;

  @Column({ name: 'changed_by_id' })
  changedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'changed_by_id' })
  changedBy!: User;

  @Column({ length: 100 })
  material!: string;

  @Column({ name: 'material_type', length: 50 })
  materialType!: string;

  @Column({ length: 100 })
  grade!: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantity!: number;

  @Column({ length: 100 })
  size!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  length?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  width?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  thickness?: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  diameter?: number;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  weight?: number;

  @Column({ name: 'weight_unit', length: 20, default: 'KG' })
  weightUnit!: string;

  @Column({ name: 'revision_reason', type: 'text', nullable: true })
  revisionReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
