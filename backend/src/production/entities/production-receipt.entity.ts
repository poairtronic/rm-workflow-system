import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { MaterialIssue } from '../../material-issue/entities/material-issue.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { MaterialReceiptItem } from './material-receipt-item.entity.js';

export enum ReceiptStatus {
  RECEIVED = 'RECEIVED',
  PARTIAL = 'PARTIAL',
  DISCREPANCY = 'DISCREPANCY',
}

@Entity('material_receipts')
export class MaterialReceipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_issue_id' })
  materialIssueId!: string;

  @ManyToOne(() => MaterialIssue, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'material_issue_id' })
  materialIssue!: MaterialIssue;

  @Column({ name: 'received_by_id' })
  receivedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy!: User;

  @Column({
    type: 'varchar',
    length: 50,
    default: ReceiptStatus.RECEIVED,
  })
  status!: ReceiptStatus;

  @Index({ unique: true, where: "idempotency_key IS NOT NULL" })
  @Column({ name: 'idempotency_key', length: 100, nullable: true })
  idempotencyKey?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToMany(() => MaterialReceiptItem, (item) => item.materialReceipt, {
    cascade: true,
  })
  items!: MaterialReceiptItem[];

  @Column({
    name: 'received_at',
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  receivedAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
