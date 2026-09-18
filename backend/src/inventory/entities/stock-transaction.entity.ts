import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity.js';
import { Product } from './product.entity.js';
import { Bin } from './bin.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum TransactionType {
  STOCK_IN = 'STOCK_IN',
  STOCK_OUT = 'STOCK_OUT',
  STORES_ISSUE = 'STORES_ISSUE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER',
}

export enum AdjustmentDirection {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

@Entity('stock_transactions')
@Check(`"quantity" > 0`)
export class StockTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'product_id', nullable: true })
  productId?: string;

  @ManyToOne(() => Product, (product) => product.stockTransactions, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'product_id' })
  product?: Product;

  @Column({ name: 'inventory_item_id', nullable: true })
  inventoryItemId?: string;

  @ManyToOne(() => InventoryItem, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'inventory_item_id' })
  inventoryItem?: InventoryItem;

  @Column({ name: 'source_bin_id', nullable: true })
  sourceBinId?: string;

  @ManyToOne(() => Bin, (bin) => bin.sourceTransactions, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'source_bin_id' })
  sourceBin?: Bin;

  @Column({ name: 'destination_bin_id', nullable: true })
  destinationBinId?: string;

  @ManyToOne(() => Bin, (bin) => bin.destinationTransactions, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'destination_bin_id' })
  destinationBin?: Bin;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: TransactionType,
  })
  transactionType!: TransactionType;

  @Column({
    name: 'adjustment_direction',
    type: 'enum',
    enum: AdjustmentDirection,
    nullable: true,
  })
  adjustmentDirection?: AdjustmentDirection;

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
