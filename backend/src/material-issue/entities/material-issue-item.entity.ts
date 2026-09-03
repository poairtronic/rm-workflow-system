import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MaterialIssue } from './material-issue.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';
import { ProductionReceipt } from '../../production/entities/production-receipt.entity.js';

@Entity('material_issue_items')
export class MaterialIssueItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_issue_id' })
  materialIssueId!: string;

  @ManyToOne(() => MaterialIssue, (issue) => issue.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'material_issue_id' })
  materialIssue!: MaterialIssue;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, (rmItem) => rmItem.materialIssues, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'quantity_issued',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantityIssued!: number;

  @Column({ name: 'heat_number', nullable: true, length: 100 })
  heatNumber?: string;

  @Column({ name: 'batch_number', nullable: true, length: 100 })
  batchNumber?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @OneToOne(() => ProductionReceipt, (receipt) => receipt.materialIssueItem)
  productionReceipt?: ProductionReceipt;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
