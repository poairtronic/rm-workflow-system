import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Check,
} from 'typeorm';
import { ProductFamily } from './product-family.entity.js';
import type { StockBalance } from './stock-balance.entity.js';
import type { StockTransaction } from './stock-transaction.entity.js';
import type { MslAlert } from './msl-alert.entity.js';

@Entity('products')
@Check(`"minimum_inventory" >= 0`)
@Check(
  `"maximum_inventory" IS NULL OR "maximum_inventory" >= "minimum_inventory"`,
)
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'family_id' })
  familyId!: string;

  @ManyToOne(() => ProductFamily, (family) => family.products, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'family_id' })
  family!: ProductFamily;

  @Column({ length: 100, nullable: true, unique: true })
  code?: string;

  @Column({ length: 255, unique: true })
  name!: string;

  @Column({
    name: 'minimum_inventory',
    type: 'numeric',
    precision: 12,
    scale: 3,
    default: 0,
  })
  minimumInventory!: number;

  @Column({
    name: 'maximum_inventory',
    type: 'numeric',
    precision: 12,
    scale: 3,
    nullable: true,
  })
  maximumInventory?: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ length: 50, nullable: true, default: 'KG' })
  uom?: string;

  @OneToMany('StockBalance', (balance: any) => balance.product)
  stockBalances?: StockBalance[];

  @OneToMany('StockTransaction', (tx: any) => tx.product)
  stockTransactions?: StockTransaction[];

  @OneToMany('MslAlert', (alert: any) => alert.product)
  mslAlerts?: MslAlert[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
