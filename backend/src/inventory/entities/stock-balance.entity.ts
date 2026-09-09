import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, Check } from 'typeorm';
import type { InventoryItem } from './inventory-item.entity.js';
import { StockTransaction } from './stock-transaction.entity.js';

@Entity('stock_balances')
@Check(`"current_quantity" >= 0`)
export class StockBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'inventory_item_id', unique: true })
  inventoryItemId!: string;

  @OneToOne('InventoryItem', (item: InventoryItem) => item.stockBalance, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem!: InventoryItem;

  @Column({
    name: 'current_quantity',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  currentQuantity!: number;

  @Column({
    name: 'opening_balance',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  openingBalance?: number;

  @Column({ name: 'last_transaction_id', nullable: true })
  lastTransactionId?: string;

  @OneToOne(() => StockTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_transaction_id' })
  lastTransaction?: StockTransaction;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
