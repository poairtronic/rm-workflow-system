import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MaterialIssueItem } from '../../material-issue/entities/material-issue-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('production_receipts')
export class ProductionReceipt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'material_issue_item_id', unique: true })
  materialIssueItemId!: string;

  @OneToOne(() => MaterialIssueItem, (item) => item.productionReceipt, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'material_issue_item_id' })
  materialIssueItem!: MaterialIssueItem;

  @Column({
    name: 'received_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  receivedQuantity!: number;

  @Column({ name: 'received_by_id' })
  receivedById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy!: User;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt!: Date;
}
