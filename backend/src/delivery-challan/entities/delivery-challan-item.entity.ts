import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { DeliveryChallan } from './delivery-challan.entity.js';
import { Product } from '../../inventory/entities/product.entity.js';
import { Bin } from '../../inventory/entities/bin.entity.js';

@Entity('delivery_challan_items')
@Index('IDX_dci_challan_id', ['challanId'])
@Index('IDX_dci_product_id', ['productId'])
@Index('IDX_dci_bin_id', ['binId'])
export class DeliveryChallanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'challan_id', type: 'uuid' })
  challanId: string;

  @ManyToOne(() => DeliveryChallan, (challan) => challan.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'challan_id' })
  challan: Relation<DeliveryChallan>;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ name: 'bin_id', type: 'uuid' })
  binId: string;

  @ManyToOne(() => Bin)
  @JoinColumn({ name: 'bin_id' })
  bin: Bin;

  @Column({ name: 'quantity_dispatched', type: 'numeric', precision: 12, scale: 3 })
  quantityDispatched: number;

  @Column({ name: 'quantity_returned', type: 'numeric', precision: 12, scale: 3, default: 0 })
  quantityReturned: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
