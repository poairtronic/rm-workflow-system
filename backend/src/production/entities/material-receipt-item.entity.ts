import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MaterialReceipt } from './production-receipt.entity.js';
import { RmItem } from '../../rm/entities/rm-item.entity.js';

@Entity('material_receipt_items')
export class MaterialReceiptItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'material_receipt_id' })
  materialReceiptId!: string;

  @ManyToOne(() => MaterialReceipt, (receipt) => receipt.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'material_receipt_id' })
  materialReceipt!: MaterialReceipt;

  @Index()
  @Column({ name: 'rm_item_id' })
  rmItemId!: string;

  @ManyToOne(() => RmItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rm_item_id' })
  rmItem!: RmItem;

  @Column({
    name: 'quantity_received',
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantityReceived!: number;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
