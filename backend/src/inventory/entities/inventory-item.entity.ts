import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  OneToOne,
} from 'typeorm';
import type { StockBalance } from './stock-balance.entity.js';

@Entity('inventory_items')
@Unique(['material', 'materialType', 'grade', 'size'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  material!: string;

  @Column({ name: 'material_type', length: 50 })
  materialType!: string;

  @Column({ length: 100 })
  grade!: string;

  @Column({ length: 100 })
  size!: string;

  @Column({ length: 20, default: 'KG' })
  unit!: string;

  @Column({
    name: 'minimum_stock_level',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  minimumStockLevel!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @OneToOne('StockBalance', (balance: StockBalance) => balance.inventoryItem)
  stockBalance?: StockBalance;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
