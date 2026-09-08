import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Check } from 'typeorm';
import { InventoryItem } from './inventory-item.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum TransactionType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  ADJUSTMENT = 'ADJUSTMENT',
}

@Entity('stock_transactions')
@Check(`"quantity" > 0`)
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id' })
  inventoryItemId!: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItem;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: TransactionType,
  })
  transactionType!: TransactionType;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
  })
  quantity!: number;

  @Column({ length: 50 })
  referenceType!: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ name: 'created_by_id' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy!: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
